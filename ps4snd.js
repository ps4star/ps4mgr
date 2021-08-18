const readline = require('readline')

// snd script
const args = process.argv.slice(2)

if (args.length == 0) {
    startInteractive()
} else {
    determineAndRunOp(args)
}

function determineAndRunOp(args) {
    // determine operation and run it
    if (args[0] == "x" || args[0] == "extract") {
        // extract operation
        startExtract(args.slice(1))
    } else if (args[0] == "l" || args[0] == "list") {
        // list operation
        startList()
    }
}

async function startInteractive() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

    let choice = ""
    await new Promise(resolve => {
        rl.question("ps4snd> ", (res) => {
            choice = res
            resolve()
        })
    })

    rl.close()
}

function startExtract(args) {

}

function startList() {

}