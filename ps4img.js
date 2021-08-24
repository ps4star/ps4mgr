const {
    toHex,
    log,
    clr,
    exitWith,
    init,
    readFileNoPrefix,
    readFile,
    writeFile,
    getSection,
    spliceSection,
    getByteArrayFromDbLine,
    convertSigned,
    getBit,
    LineStepper,
} = require('./scriptutil.js')

const readline = require('readline')
const fs = require('fs')
const bmp = require('bmp-js')

class Color {
    constructor(r, g, b) {
        this.r = r
        this.g = g
        this.b = b
        this.a = 0xFF
    }
}

const COLORS = [
    new Color(0, 0, 0),
    new Color(16, 16, 16),
    new Color(32, 32, 32),
    new Color(48, 48, 48),
    new Color(64, 64, 64),
    new Color(80, 80, 80),
    new Color(96, 96, 96),
    new Color(112, 112, 112),
    new Color(128, 128, 128),
    new Color(144, 144, 144),
    new Color(160, 160, 160),
    new Color(176, 176, 176),
    new Color(192, 192, 192),
    new Color(208, 208, 208),
    new Color(224, 224, 224),
    new Color(240, 240, 240),
]
for (let i = 0; i < 16; i++) {
    COLORS.push(i * 16, i * 16, i * 16, 0x00)
}

function get4byteArrayOfInt(n) {
    return [ Math.floor(n / (256**3)) % 256, Math.floor(n / (256**2)) % 256, Math.floor(n / 256) % 256, n % 256 ]
}

function nemesisExtract(args) {
    // gets word header
    const graphicsDirs = fs.readdirSync("ps4disasm/graphics")
    graphicsDirs.forEach(dir => {
        const filesInThisDir = fs.readdirSync(`ps4disasm/graphics/${dir}`)
        filesInThisDir.forEach(file => {
            if (args[args.length - 1] != "nx") {
                if (file.replace(".bin", "").replace(/ /g, "").toLowerCase() != args[args.length - 1].toLowerCase()) {
                    return
                }
            }

            // continue if not .bin file (could be an already-extracted .bmp)
            if (!(file.toLowerCase().includes("nemesis"))) return
            if (!file.endsWith(".bin")) return

            const fileTxt = Array.from(fs.readFileSync(`ps4disasm/graphics/${dir}/${file}`))
            
            // first word of file; specifies num patterns; if sign=1 XOR, sign=0 NORM
            const headerWord = fileTxt[0] * 256 + fileTxt[1]
            const isXor = getBit(15, headerWord)
            const numPatterns = headerWord & 0x7FFF

            // parse codedef section
            let i = 2, palIndex
            const codes = {}
            while (true) {
                const firstByte = fileTxt[i]
                
                // break now if 0xFF (end of code section marker)
                if (firstByte == 0xFF) {
                    i++
                    break
                }

                const isNewPalIndex = getBit(7, firstByte)

                let numCopies, codeBitLen, code

                if (isNewPalIndex) {
                    // lower nibble = pal index
                    palIndex = firstByte & 0b00001111

                    // get next byte; upper = numTimesToCopy - 1, lower = bitLenOfCode
                    i++
                    const nextByte = fileTxt[i]
                    numCopies = (nextByte & 0b11110000) + 1
                    codeBitLen = nextByte & 0b00001111

                    // get next byte; this is the code byte
                    i++
                    code = fileTxt[i].toString(2).padStart(codeBitLen, "0")
                } else {
                    // skip pal index (same as before otherwise, just shifted down 1 byte)
                    numCopies = (firstByte & 0b11110000) + 1
                    codeBitLen = firstByte & 0b00001111

                    i++
                    code = fileTxt[i].toString(2).padStart(codeBitLen, "0")
                }

                // now we process everything we gathered from this code block
                codes[code] = { numCopies, codeBitLen, palIndex }

                i++
            }

            // i is now set so that it points to the byte immediately after the $FF end-of-code-section marker
            // rest of file is streamed in as a bit series

            // setup px/nibble buffer (max num stored is 15)
            const nibbles = []

            // grab rest of file as 1 solid bit stream
            const bitStream = fileTxt.slice(i).map(el => el.toString(2).padStart(8, "0")).join("")

            // this is the hard part
            // find registered codes in the data
            let l = 0, u = 1, tok = "", thisRow = [], rows = 0

            function addBytes(numCopies, palIndex) {
                for (let j = 0; j < numCopies; j++) {
                    thisRow.push(palIndex)
                    if (thisRow.length >= 8) {
                        if (isXor && nibbles.length > 0) {
                            // XORs by prev row before writing
                            const lastRow = nibbles.slice(nibbles.length - 8, nibbles.length)
                            thisRow.forEach((nib, index) => {
                                thisRow[index] = lastRow[index] ^ nib
                            })
                        }

                        nibbles.push(...thisRow)
                        thisRow = []
                    }
                }
            }

            while (l + u < bitStream.length) {
                // find out which pattern we're looking at
                tok = bitStream.substring(l, l + u)
                if (tok in codes) {
                    const { numCopies, codeBitLen, palIndex } = codes[tok]

                    addBytes(numCopies, palIndex)

                    //console.log("YA: " + tok, l)

                    // next cycle
                    l += codeBitLen
                    u = 1
                } else if (tok == "111111") {
                    // inline data
                    // 7 next bits (XXX YYYY) indicate palIndex; numCopies
                    l += 6
                    const nextBits = bitStream.substring(l, l + 7)
                    const numCopies = parseInt(nextBits.substring(0, 3), 2) + 1
                    const palIndex = parseInt(nextBits.substring(3, 7), 2)

                    addBytes(numCopies, palIndex)
                    
                    // next cycle
                    l += 7
                    u = 1
                } else {
                    if (tok.length > 8) {
                        // log(tok)
                        // log(l)
                        // log(codes)
                        break
                    }
                    u++
                }
            }

            fs.writeFileSync("test.txt", nibbles.join("\n"))

            const w = 8

            const finalBuf = new Array(nibbles.length * 4)

            function indexTransform(n) {
                const wholeWidth = 8 * w
                const wholeHeight = (numPatterns * 8) / w

                const whichBlock = Math.floor(n / 64)
                const blockRow = Math.floor(whichBlock / w)
                const blockCol = whichBlock % 8

                return (blockRow * wholeWidth * 8) + (blockCol * 8) + (Math.floor((n % 64) / 8) * wholeWidth) + (n % 8)
            }

            nibbles.forEach((el, index) => {
                index = indexTransform(index) * 4
                //index *= 4
                finalBuf[index] = COLORS[el].a
                finalBuf[index + 1] = COLORS[el].g
                finalBuf[index + 2] = COLORS[el].r
                finalBuf[index + 3] = COLORS[el].b
            })

            // now we just basically construct a BMP byte buffer lol, pretty simple
            const width = 8 * w
            const height = (numPatterns * 8) / w
            const imgData = {
                data: Buffer.from(finalBuf),
                width,
                height
            }

            const bmpBuffer = bmp.encode(imgData)

            fs.writeFileSync(`ps4disasm/graphics/${dir}/${file.replace(".bin", ".bmp")}`, bmpBuffer.data)

        })
    })
}

function nemesisReplace(args) {

}

init(process.argv.slice(2), {
    "nem-extract": nemesisExtract, "nx": nemesisExtract,
    "nem-replace": nemesisReplace, "nr": nemesisReplace,
}, "ps4img")