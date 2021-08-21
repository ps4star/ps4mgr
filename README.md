# ps4mgr

CLI manager for Phantasy Star IV files. Does not modify ROMs directly, instead edits assembly files from lory90's disassembly.

# Dependencies

NodeJS - go to https://nodejs.org to install Node if you don't have it already. The ```node``` command must be in your path.

(optional) git - auto-downloads ps4disasm upon running launcher.js

# Usage

```node launcher.js```

This script will first attempt to execute a "git clone" to download the ps4disasm files. If you don't have git installed or don't want to download the files this way, make sure a directory with the name "ps4disasm" is in the same directory as launcher.js and all other files in this repo, and that the directory is populated with all the proper ps4disasm files in all the right places.

Once downloaded, the launcher script will then prompt you to run a script such as ps4snd. Enter the number of the script you want to use, and you'll enter an interactive shell where you can launch sub-operations defined for that script (e.g. ```ps4snd> l``` to list all songs found in the game data).

You can also launch scripts individually, e.g. ```node ps4snd.js``` to launch ps4snd.

## ps4snd

```node ps4snd.js l``` - list out all music names

```node ps4snd.js x -f txt MotabiaTown``` - extract music data for the Motavia Town theme as txt format into the file "MotabiaTown.txt". Use the l operation to list out all the song names so that you know which one to use. I recommend MotabiaTown for testing since it's the first song you hear upon starting a new game.

```node ps4snd.js r -f txt MotabiaTown.txt``` - converts MotabiaTown.txt text data into raw asm bytes and inserts them into the ps4.sound_driver.asm file (location is specified in some variables within the .txt file itself, in the ".section META" section).

Remember that you can also use ps4snd from the interactive shell if you access it from launcher.js. It works exactly the same, except you omit the "node ps4snd.js" part, e.g.:

```ps4snd> l``` instead of ```node ps4snd.js l```

## ps4img

Still WIP, does nothing at the moment.

## MORE SCRIPTS COMING SOON!
