// imports
const readline = require("readline")
const fs = require("fs")
const { exec } = require("child_process")

// const
const PS4DISASM_REPO = "https://github.com/lory90/ps4disasm"
const SCRIPT_TABLE = [ "ps4snd", "ps4img", "ps4scr" ]

// some basic bitch utils
const log = (msg) => console.log(msg)
const clr = () => console.clear()
const exitWith = (msg) => { log(msg) && process.exit(1) }

// load ps4disasm
clr()
log("Welcome to ps4mgr. Setting a few things up...")
log("Checking for ps4disasm dir...")

if (!fs.existsSync("ps4disasm")) {
    log("WARN did not find ps4disasm, starting git clone. This may take a few minutes...")
    exec(`git clone ${PS4DISASM_REPO}`, () => {
        log("SUCCESS finished git clone")
        main()
    })
} else {
    log("SUCCESS found ps4disasm dir")
    main()
}

async function mainLoop(rl) {
    // disp main menu
    clr()
    log("============ PS4MGR ============")
    log("1. ps4snd - modify sound data")
    log("2. ps4img - modify images")
    log("3. ps4scr - modify scripts")

    // prompt
    await new Promise(resolve => {
        rl.question("Make a selection :: ", (res) => {
            res = res.substring(0, 1);
            if (res >= '1' && res <= SCRIPT_TABLE.length.toString()) {
                clr()
                exec( `node ${process.cwd()}/scripts/${SCRIPT_TABLE[parseInt(res) - 1]}.js`, resolve )
            } else {
                log(`Illegal option: ${res}`)
                resolve()
            }
        })
    })
}

async function main() {
    // main entry point post-setup
    // open IO interface (useful for user prompts later on)
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    // launch main loop
    await mainLoop(rl)

    // exit the readline subprocess
    rl.close()
}