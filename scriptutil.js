const fs         = require('fs')
const spawnSync  = require('child_process').spawnSync
const readline   = require('readline')

// const
const DISASM_PATH_PREFIX = "./ps4disasm"

// some basic bitch utils
const log        = (msg) => console.log(msg)
const clr        = () => console.clear()
const exitWith   = (msg) => { log(msg) && process.exit(1) }

// file IO
const readFileNoPrefix = (filePath) => fs.readFileSync(filePath, { encoding: 'utf-8' }).replace(/\r/g, "")
const readFile    = (filePath) => fs.readFileSync(`${DISASM_PATH_PREFIX}/${filePath}`, { encoding: 'utf-8' }).replace(/\r/g, "")
const writeFile   = (filePath, dt) => fs.writeFileSync(filePath, dt)
const isValidFile = (fileName) => fs.existsSync(fileName)

// convert hex num (signed) into JS int
function convertSigned(n) {
    if (n > 0x7FFF) {
        return -1 * (0x10000 - n)
    } else {
        return n
    }
}

// basic initial script setup
let isInitial = true
const init = async (args, bindings, promptStr) => {
    // run specified script
    if (args[0] in bindings) {
        bindings[args[0]](args.slice(1))
    } else if (args[0] == "q" || args[0] == "quit" || args[0] == "exit") {
        // exit
        return
    } else if (args[0]) {
        // illegal op
        log(`ERROR no such operation ${args[0]} defined.`)
    }

    // interactive
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    let choice = await new Promise(resolve => {
        // do not prompt if ran with args
        if (isInitial && args[0]) {
            rl.close()
            return
        }

        rl.question(`${promptStr}> `, (res) => {
            rl.close()
            resolve(res)
        })
    })

    isInitial = false

    await init(choice.split(" "), bindings, promptStr)
}

// grabs slice of asm block
const getSection = (block, start, end) => {
    const beginSlice = block.substring(block.indexOf(start))
    return beginSlice.substring(0, beginSlice.indexOf(end))
}

// splices section of asm block
const spliceSection = (block, start, end, newContent) => {
    const startIndex = block.indexOf(start)
    const startSlice = block.substring(startIndex)
    const endIndex = startSlice.indexOf(end)

    return block.substring(0, startIndex) + newContent + startSlice.substring(endIndex)
}

// converts a "dc.b $xx, $yy, $zz..." line -> [xx, yy, zz] (raw byte array)
const getByteArrayFromDbLine = (dbLine) => new Uint8Array( [ ...dbLine.matchAll(/\$([0-9A-F]{2})(,|$)/g) ].map(matched => parseInt(matched[1])) )

// class for going through lines
class LineStepper {
    constructor(txt) {
        this.lines = txt.split("\n")
        this.i = 0
    }

    stepUntil(lStart) {
        // steps until line starting with lStart is found
        while (!this.lines[this.i].startsWith(lStart)) {
            this.i++
        }
        return this.lines[this.i++]
    }

    stepUntilNotWhitespace() {
        while (!this.lines[this.i].replace(/(\t| )/g, "")) this.i++
        return this.lines[this.i++]
    }

    stepUntilMulti(lStart, times) {
        const arr = []
        for (let i = 0; i < times; i++) {
            arr.push(this.stepUntil(lStart))
        }
        return arr
    }

    step() {
        return this.lines[this.i++]
    }

    stepBack(by) {
        this.i -= by ?? 1
    }

    getRest() {
        return this.lines.slice(this.i).join("\n")
    }

    isEOF() {
        return this.i >= this.lines.length - 1
    }
}

module.exports = { log, clr, exitWith, readFileNoPrefix, readFile, writeFile,
    isValidFile, init, spawnSync, getSection, spliceSection, getByteArrayFromDbLine,
    convertSigned, LineStepper }