// imports
// spawnSync used for executing sub-scripts, but child_process's exec is fine for
// the git clone process in particular since it halts stdin/stdout
const { clr, log, exitWith, spawnSync, readFile, isValidFile } = require('./scriptutil')
const { exec } = require('child_process')
const readline = require('readline')

// const
const PS4DISASM_REPO = "https://github.com/lory90/ps4disasm"
const SCRIPT_TABLE = [ "ps4snd", "ps4img", "ps4scr" ]

// load ps4disasm
clr()

if (!isValidFile("ps4disasm")) {
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
    log("(COMING SOON TM) 2. ps4img - modify images")

    // prompt
    await new Promise(resolve => {
        rl.question("Make a selection :: ", (res) => {
            res = res.substring(0, 1);
            if (res >= '1' && res <= SCRIPT_TABLE.length.toString()) {
                clr()
                spawnSync(`node`, [`${ process.cwd() }/${ SCRIPT_TABLE[parseInt(res) - 1] }.js`], {
                    stdio: [ 'inherit', 'inherit', 'inherit' ],
                })

                // prevents glitchy % sign thing on exit
                log("")
                process.exit(0)
            } else if (!res) {
                mainLoop(rl)
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