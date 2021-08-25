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
    LineStepper,
} = require('./scriptutil.js')

const readline = require('readline')

const T_PAN_E0 = "pan"
const T_DETUNE_E1 = "detune"
const T_SETCOMM_E2 = "set_comm"
const T_VOLCTRL_E3 = "vol_ctrl"
const T_LOOPDAC_E4 = "loop_dac"
const T_VOLFMP_E5 = "vol_fmp"
const T_VOLFM_E6 = "vol_fm"
const T_HOLD_E7 = "hold"
const T_NOTESTOP_E8 = "note_stop"
const T_LFO_E9 = "lfo"
const T_TEMPO_EA = "tempo"
const T_SNDCMD_EB = "snd_cmd"
const T_VOLPSG_EC = "vol_psg"
const T_PANDAC_ED = "pan_dac"
const T_SETSND_EE = "set_snd"
const T_INSTRUMENT_EF = "instrument"
const T_MODSETUP_F0 = "mod_setup"
const T_MODFMP_F1 = "mod_fmp"
const T_TRACKEND_F2 = "end_track"
const T_PSGNOISE_F3 = "psg_noise"
const T_MODGEN_F4 = "mod_gen"
const T_INSTRUMENTPSG_F5 = "instrument_psg"
const T_GOTO_F6 = "goto"
const T_LOOP_F7 = "loop"
const T_GOSUB_F8 = "gosub"
const T_RETURN_F9 = "return"
const T_REVERSE_FA = "reverse"
const T_TRANSPOSE_FB = "transpose"
const T_VOLDAC_FC = "vol_dac"
const T_TRACKMODE_FD = "track_mode"
const T_SPCFM3_FE = "spc_fm3"
const T_METACF_FF = "meta_cf"

const T_ELSE = "??"

const T_NOTE = "n"
const T_DURATION = "d"

const T_POSITIVE_LBL = "+"
const T_NEGATIVE_LBL = "-"

const ALL_TOKENS = [ T_NOTE, T_DURATION, T_PAN_E0, T_DETUNE_E1, T_SETCOMM_E2, T_VOLCTRL_E3, T_LOOPDAC_E4, T_VOLFMP_E5, T_VOLFM_E6, T_HOLD_E7,
    T_NOTESTOP_E8, T_LFO_E9, T_TEMPO_EA, T_SNDCMD_EB, T_VOLPSG_EC, T_PANDAC_ED, T_SETSND_EE, T_INSTRUMENT_EF, T_MODSETUP_F0, T_MODFMP_F1,
    T_TRACKEND_F2, T_PSGNOISE_F3, T_MODGEN_F4, T_INSTRUMENTPSG_F5, T_GOTO_F6, T_LOOP_F7, T_GOSUB_F8, T_RETURN_F9, T_REVERSE_FA, T_TRANSPOSE_FB,
    T_VOLDAC_FC, T_TRACKMODE_FD, T_SPCFM3_FE, T_METACF_FF, T_ELSE ]

const NOTES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"]
const MIDDLE_C = 0xBA

const sndAsm = readFile("sound/ps4.sound_driver.asm").replace(/\n\n\n+/g, "\n\n")

function getHeader(sndBlock) {
    const retObj = {}

    // make a LineStepper
    const stepper = new LineStepper(sndBlock)

    // grab header data
    retObj.initialBlockPtrLn = stepper.stepUntil("\tdc.w")
    retObj.headerLn = stepper.stepUntil("\tdc.b");
    [ retObj.numChan, retObj.addChan, retObj.noteLen, retObj.speed ] = getByteArrayFromDbLine(retObj.headerLn)

    retObj.channelPtrsLn = stepper.stepUntilMulti("\tdc.w", retObj.numChan)
    retObj.addChannelWordsLn = stepper.stepUntilMulti("\tdc.w", retObj.addChan)
    stepper.stepBack((retObj.addChan - 1) * 2)
    retObj.addChannelBytesLn = stepper.stepUntilMulti("\tdc.b", retObj.addChan)

    // get rest of snd block without header
    stepper.step()
    const rest = stepper.getRest()

    return [ retObj, rest ]
}

function getChannels(headlessSndBlock) {
    return headlessSndBlock.split("\n\n")
}

function channelTextToBytes(channelText) {
    // converts text of entire channel data to a raw byte buffer
    const channelTextLines = channelText.split("\n")
    return [ channelTextLines[0], new Uint8Array( channelTextLines.slice(1).join("\n").replace(/dc.b/g, "").replace(/\;.+/g, "").replace(/, /g, "")
        .replace(/\$/g, " ").replace(/\n/g, "").replace(/\t/g, "").replace(/ +/g, " ").split(" ").filter(el => !!el).map(el => parseInt(el, 16)) ) ]
}

function byteToNote(byte) {
    // converts byte to note based on middle C byte (0xBA)
    const distFromC = byte - MIDDLE_C

    // c4 = 0xBA
    // c3 = 0xAE
    // d#3 = 0xB0

    // calculates octave to use
    const baseOct = 4 + Math.floor(distFromC / 12)

    let charToUse
    if (distFromC < 0) {
        const offset = (Math.abs(distFromC) % NOTES.length)
        if (offset == 0) {
            charToUse = NOTES[0]
        } else {
            charToUse = NOTES[NOTES.length - offset]
        }
    } else {
        charToUse = NOTES[distFromC % NOTES.length]
    }

    // return char + oct
    return charToUse + baseOct.toString()
}

function noteToByte(note) {
    // middle C = 0xBA
    const noteParts = []

    // dumb little token system thing to sep. note id and octave num
    // only necessary for negative values
    let tok = ""
    let hasPushed = false
    note.split("").forEach((char, i) => {
        if ((char == "-" || (char >= '0' && char <= '9')) && !hasPushed) {
            noteParts.push(tok)
            tok = ""
            hasPushed = true
        }
        tok += char.toLowerCase().replace("cb", "b").replace("bb", "a#").replace("ab", "g#").replace("gb", "f#")
            .replace("fb", "e").replace("eb", "d#").replace("db", "c#")
    })
    noteParts.push(tok)

    const oct = parseInt(noteParts[1])
    const noteName = noteParts[0]

    return MIDDLE_C + ((oct - 4) * 12) + NOTES.indexOf(noteName)
}

function parseFormatSndNameArgs(args) {
    // parse args to find format
    let format = "txt",
        sndName = args[args.length - 1]

    args.forEach((el, i) => {
        if (el == "-f") {
            if (i >= args.length - 2) {
                // not enough params, only specifies format but not name
                log("ERROR not enough parameters specified. Format given but no snd name.")
                process.exit(1)
            }
            format = args[i + 1]
        }
    })

    return [ format, sndName ]
}

function getNumBytes(ln) {
    ln = ln.trimStart()
    const op = ln.split(" ")[0]
    if (!ln || ln.charAt(0) == "." || /^.+\=.+$/.test(ln)) return 0
    if (op === T_NOTE || op === T_DURATION) {
        return 1
    } else if (op === T_LOOP_F7) {
        return 5
    } else if (op === T_GOSUB_F8 || op === T_GOTO_F6) {
        return 3
    } else if (op === T_HOLD_E7) {
        return 1
    } else if (op === T_METACF_FF) {
        return 1
    } else if (/^.+:$/.test(ln)) {
        // is lbl
        return 0
    } else {
        return ln.split(" ").length
    }
}

function doPushback(num, outBuf, lblName) {
    num = Math.abs(num)

    // accounts for current ins
    num -= 2
    let i = outBuf.length - 1
    while (num > 0) {
        const numBytesThisLn = getNumBytes(outBuf[i])
        num -= numBytesThisLn
        i--
    }

    // num == 0, now we splice in the lbl
    outBuf.splice(i, 0, `${lblName}:`)
}

function startExtract(args) {
    // calls list with output redirection to get music ptr table
    // (this may not even be useful here, but keeping it commented just in case)
    // let musicPtrTable = ""
    // startList((ln) => musicPtrTable += ln + "\n")
    const [ format, sndName ] = parseFormatSndNameArgs(args)

    // perform extraction
    const sndLabel = `Music_${sndName}:\n`
    const sndBlock = getSection(sndAsm, sndLabel, "\n; -----")
    const fname = `${sndName}.${format}`

    // output function
    const out = (fileName, msg) => writeFile(fileName, msg)

    const dt = []
    let numPLbls = 0
    let numNLbls = 0
    let numLoops = 0
    if (format == "asm") {
        // simply output sndBlock and return
        out(fname, sndBlock)
        log(`SUCCESS wrote output to ${fname}.`)
    } else if (format == "txt") {
        // output to a text-based format
        // grab header
        const [ headerObj, rest ] = getHeader(sndBlock)

        // grab arr. of channel texts
        const channels = getChannels(rest)

        // util func for int -> hex str
        const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase()

        const outBuf = [
            `.section META
PRESERVE_MUSICPTR_TABLE=true
PRESERVE_ORIGINAL_HEADER=true
BLOCK_BEGIN_TAG=Music_${sndName}:(NEWLINE)
BLOCK_END_TAG=(NEWLINE); -----
CREATION_METHOD=extracted

.section MAIN`,
        ]

        channels.forEach(chan => {
            const [ chanHeader, chanBytes ] = channelTextToBytes(chan)
            outBuf.push("\n" + chanHeader)

            var i = 0
            const next = () => toHex(chanBytes[++i])
            const nextByte = () => chanBytes[++i]
            const putNoTab = (str) => outBuf.push(str)
            const put  = (str) => putNoTab(`\t${str}`)

            // setup future timer/event list (useful for labels later on)
            const timers = []

            // evaluate chan bytes
            for (; i < chanBytes.length; i++) {
                const byte = chanBytes[i]

                timers.forEach((timer, index) => {
                    if (i == timer[1]) {
                        putNoTab(`${timer[0]}:`)
                        timers.splice(index)
                    }
                })

                if (byte == 0xE0) {
                    // pan
                    put(`${T_PAN_E0} ${next()}`)
                } else if (byte == 0xE1) {
                    // detune
                    put(`${T_DETUNE_E1} ${next()}`)
                } else if (byte == 0xE2) {
                    // set_comm
                    put(`${T_SETCOMM_E2} ${next()}`)
                } else if (byte == 0xE3) {
                    // volctrl
                    put(`${T_VOLCTRL_E3} ${next()}`)
                } else if (byte == 0xE4) {
                    // loop
                    put(`${T_LOOPDAC_E4} ${next()}`)
                } else if (byte == 0xE5) {
                    // vol_fmp
                    put(`${T_VOLFMP_E5} ${next()} ${next()}`)
                } else if (byte == 0xE6) {
                    // vol_fm
                    put(`${T_VOLFM_E6} ${next()}`)
                } else if (byte == 0xE7) {
                    // hold
                    put(`${T_HOLD_E7}`)
                } else if (byte == 0xE8) {
                    // note_stop
                    put(`${T_NOTESTOP_E8} ${next()}`)
                } else if (byte == 0xE9) {
                    // lfo
                    put(`${T_LFO_E9} ${next()} ${next()}`)
                } else if (byte == 0xEA) {
                    // tempo
                    put(`${T_TEMPO_EA} ${next()}`)
                } else if (byte == 0xEB) {
                    // snd_cmd
                    put(`${T_SNDCMD_EB} ${next()}`)
                } else if (byte == 0xEC) {
                    // vol_psg
                    put(`${T_VOLPSG_EC} ${next()}`)
                } else if (byte == 0xED) {
                    // pan_dac
                    put(`${T_PANDAC_ED} ${next()}`)
                } else if (byte == 0xEE) {
                    // set_snd
                    put(`${T_SETSND_EE} ${next()}`)
                } else if (byte == 0xEF) {
                    // instrument
                    put(`${T_INSTRUMENT_EF} ${next()}`)
                } else if (byte == 0xF0) {
                    // mod_setup
                    put(`${T_MODSETUP_F0} ${next()} ${next()} ${next()} ${next()}`)
                } else if (byte == 0xF1) {
                    // mod_fmp
                    put(`${T_MODFMP_F1} ${next()} ${next()}`)
                } else if (byte == 0xF2) {
                    // track_end
                    put(`${T_TRACKEND_F2}`)
                } else if (byte == 0xF3) {
                    // psg_noise
                    put(`${T_PSGNOISE_F3} ${next()}`)
                } else if (byte == 0xF4) {
                    // mod_gen
                    put(`${T_MODGEN_F4} ${next()}`)
                } else if (byte == 0xF5) {
                    // instrument_psg
                    put(`${T_INSTRUMENTPSG_F5} ${next()}`)
                } else if (byte == 0xF6) {
                    // goto
                    const n1 = nextByte(), n2 = nextByte()
                    const actualNum = convertSigned(n1 * 256 + n2)

                    const lblName = actualNum >= 0 ? T_POSITIVE_LBL.repeat(++numPLbls) : T_NEGATIVE_LBL.repeat(++numNLbls)

                    if (actualNum >= 0) {
                        timers.push([ lblName, i + actualNum ])
                    } else {
                        doPushback(actualNum, outBuf, lblName)
                    }

                    put(`${T_GOTO_F6} ${lblName}`)
                } else if (byte == 0xF7) {
                    // loop
                    const loopNum1 = next(), loopNum2 = next()
                    const n1 = nextByte(), n2 = nextByte()
                    const actualNum = convertSigned(n1 * 256 + n2)

                    const lblName = `loop${++numLoops}`

                    if (actualNum >= 0) {
                        timers.push([ lblName, i + actualNum ])
                    } else {
                        doPushback(actualNum, outBuf, lblName)
                    }

                    put(`${T_LOOP_F7} ${loopNum1} ${loopNum2} ${lblName}`)
                } else if (byte == 0xF8) {
                    // gosub
                    const n1 = nextByte(), n2 = nextByte()
                    const actualNum = convertSigned(n1 * 256 + n2)

                    const lblName = actualNum >= 0 ? T_POSITIVE_LBL.repeat(++numPLbls) : T_NEGATIVE_LBL.repeat(++numNLbls)

                    if (actualNum >= 0) {
                        timers.push([ lblName, i + actualNum ])
                    } else {
                        doPushback(actualNum, outBuf, lblName)
                    }

                    put(`${T_GOSUB_F8} ${lblName}`)
                } else if (byte == 0xF9) {
                    // return
                    put(`${T_RETURN_F9}`)
                } else if (byte == 0xFA) {
                    // reverse
                    put(`${T_REVERSE_FA} ${next()}`)
                } else if (byte == 0xFB) {
                    // transpose
                    put(`${T_TRANSPOSE_FB} ${next()}`)
                } else if (byte == 0xFC) {
                    // vol_dac
                    put(`${T_VOLDAC_FC} ${next()}`)
                } else if (byte == 0xFD) {
                    // track_mode
                    put(`${T_TRACKMODE_FD} ${next()}`)
                } else if (byte == 0xFE) {
                    // spc_fm3
                    put(`${T_SPCFM3_FE} ${next()} ${next()} ${next()} ${next()}`)
                } else if (byte == 0xFF) {
                    // meta-cf
                    put(`${T_METACF_FF}`)
                } else if (byte <= 0xDF && byte >= 0x81) {
                    // true and honest note
                    put(`${T_NOTE} ${byteToNote(byte)}`)
                } else if (byte == 0x80) {
                    // rest
                    put(`r`)
                } else if (byte < 0x80) {
                    // durset
                    put(`${T_DURATION} ${byte.toString()}`)
                } else {
                    // ??
                    put(`${T_ELSE} ${toHex(byte)}`)
                }
            }
        })

        out(fname, outBuf.join("\n"))
    }
}

function startList(outputFunction) {
    if (typeof outputFunction !== 'function') outputFunction = log

    // grab music ptr table and list all the contents
    const musicPtrTable = getSection(sndAsm, "MusicPtrs:\n\n", "\n\SndPriorities:")

    let i = 0
    for (line of musicPtrTable.split("\n")) {
        if (!line) continue
        outputFunction(`${line.substring(line.indexOf("_") + 1, line.indexOf(":"))} ${i}`)
        i++
    }
}

function startReplace(args) {
    // parse args
    const [ format, fileName ] = parseFormatSndNameArgs(args)

    // format isn't relevant here because you aren't going to be using asm blocks for this anyway
    // only txt is accepted for now
    
    // for some reason, introducing a T_REST ("r") token just broke relative jump labels
    // so instead we'll make it an alias of "n d-1"
    const txtFile = readFileNoPrefix(fileName).replace(/\n\tr\n/g, "\n\tn d-1\n")
    const stepper = new LineStepper(txtFile)

    stepper.stepUntil(".section META")

    // grab all meta vars
    const preserveMusicPtrTable = stepper.stepUntil("PRESERVE_MUSICPTR_TABLE").split("=")[1] === "true"
    const preserveOriginalHeader = stepper.stepUntil("PRESERVE_ORIGINAL_HEADER").split("=")[1] === "true"
    const blockBeginTag = stepper.stepUntil("BLOCK_BEGIN_TAG").split("=")[1].replace(/\(NEWLINE\)/g, "\n")
    const blockEndTag = stepper.stepUntil("BLOCK_END_TAG").split("=")[1].replace(/\(NEWLINE\)/g, "\n")
    const creationMethod = stepper.stepUntil("CREATION_METHOD").split("=")[1]
    
    stepper.stepUntil(".section MAIN")
    const inBuf = [ stepper.stepUntilNotWhitespace() ]

    if (/^(\+|\-)/.test(inBuf[0])) inBuf.splice(0, 1)
    
    const allByteArrays = []
    const lbls = {}
    let byteLenSoFar = 0
    let t = 0, t2 = 0

    while (!stepper.isEOF()) {
        let thisLn = stepper.step().replace(/ +/g, " ").replace(/\t+/g, "\t").trimStart()
        if (!thisLn) continue
        if (/^.+:$/.test(thisLn)) {
            // is lbl
            if (thisLn.startsWith("loc_")) {
                inBuf.push("\n" + thisLn)
            }
        } else {
            // is instruction
            const thisByteArray = []
            ALL_TOKENS.forEach((token, i) => {
                if (thisLn.split(" ")[0] == token) {
                    if (i == ALL_TOKENS.indexOf(T_GOSUB_F8) || i == ALL_TOKENS.indexOf(T_GOTO_F6) || i == ALL_TOKENS.indexOf(T_LOOP_F7)) {
                        // goto / gosub / loop pre-process
                        let lblName,
                            isLoop = false

                        if (!(i == ALL_TOKENS.indexOf(T_LOOP_F7))) {
                            lblName = thisLn.split(" ")[1]
                        } else {
                            lblName = thisLn.split(" ")[3]
                            isLoop = true
                        }

                        // go through entire file to search for 
                        const txtLines = txtFile.split("\n")
                        let numBytes = 0
                        txtLines.forEach(line => {
                            numBytes += getNumBytes(line)
                            if (t == 0 && t2 < 50) {
                                t2++
                            }
                            if (line == `${lblName}:`) {
                                const diff = (numBytes - byteLenSoFar) - 2
                                let hexValue = diff >= 0 ? diff : 0x10000 + diff
                                hexValue = hexValue.toString(16).toUpperCase().padStart(4, "0")

                                const thisLnParts = thisLn.split(" ")
                                if (!isLoop) {
                                    thisLn = thisLnParts[0] + " " + hexValue.substring(0, 2) + " " + hexValue.substring(2, 4)
                                } else {
                                    thisLn = `${thisLnParts[0]} ${thisLnParts[1]} ${thisLnParts[2]} ${hexValue.substring(0, 2)} ${hexValue.substring(2, 4)}`
                                }
                            }
                        })
                        t++
                    }
                    
                    if (i >= 2 && i <= 33) {
                        // is one of the E0 - FF cmds
                        thisByteArray.push(0xE0 + (i - 2))
                        thisByteArray.push(...thisLn.split(" ").slice(1).map(el => parseInt(el, 16)))

                        byteLenSoFar += thisLn.split(" ").length
                    } else if (i == 0) {
                        // is note
                        thisByteArray.push(noteToByte(thisLn.split(" ")[1]))

                        byteLenSoFar += 1
                    } else if (i == 1 || i == 34) {
                        // is duration (or T_ELSE fallback, but that should never happen)
                        thisByteArray.push(parseInt(thisLn.split(" ")[1]))

                        byteLenSoFar += 1
                    } else if (i == 35) {
                        // rest
                        thisByteArray.push(0x80)
                    }
                }
            })

            if (thisByteArray.length == 0) continue

            // parse byte array into usable dc.b statement
            inBuf.push(`\tdc.b\t`)
            for (let i = 0; i < thisByteArray.length; i++) {
                const finalStr = `$${thisByteArray[i].toString(16).toUpperCase().padStart(2, "0")}`
                if (i == thisByteArray.length - 1) {
                    inBuf[inBuf.length - 1] += finalStr
                } else {
                    inBuf[inBuf.length - 1] += ( finalStr + ", " )
                }
            }
        }
    }

    const thisSection = getSection(sndAsm, blockBeginTag, blockEndTag)
    const firstLblIndex = thisSection.search(/\n\n.+:\n/g)
    const header = thisSection.substring(0, firstLblIndex)
    
    const finishedResult = (header + "\n\n" + inBuf.join("\n")).replace(/\n\n\n+/g, "\n\n")
    const finishedFile = spliceSection(sndAsm, blockBeginTag, blockEndTag, finishedResult)
    require('fs').writeFileSync("ps4disasm/sound/ps4.sound_driver.asm", finishedFile)

    log("WROTE FILE TO ps4.sound_driver.asm!")
}

init(process.argv.slice(2), {
    x: startExtract, extract: startExtract,
    l: startList, list: startList,
    r: startReplace, replace: startReplace,
}, "ps4snd")