# ps4mgr

CLI manager for Phantasy Star IV files. Does not modify ROMs directly, instead edits assembly files from lory90's disassembly.

# Dependencies

NodeJS - go to https://nodejs.org to install Node if you don't have it already. The ```node``` command must be in your path.

(optional) git - auto-downloads ps4disasm upon running launcher.js

# Usage

ps4disasm must be in the same directory as all the files contained in this repo. If you don't have it already, make sure git is installed on your system, then run:

```node launcher.js```

You can also launch scripts individually, e.g. ```node ps4snd.js``` to launch ps4snd.

## ps4snd

```node ps4snd.js l``` - list out all music names
```node ps4snd.js x -f txt MotabiaTown``` - extract music data for the Motavia Town theme as txt format into the file "MotabiaTown.txt"
```node ps4snd.js r -f txt MotabiaTown.txt``` - converts MotabiaTown.txt text data into raw asm bytes and inserts them into the ps4.sound_driver.asm file (location is specified in some variables within the .txt file itself, in the ".section META" section).

Remember that you can also use ps4snd from the interactive shell if you access it from launcher.js. It works exactly the same, except you omit the "node ps4snd.js" part, e.g.:

```ps4snd> l``` instead of ```node ps4snd.js l```

## ps4img

Still WIP, does nothing at the moment.
