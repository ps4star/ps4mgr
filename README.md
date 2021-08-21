# ps4mgr

CLI manager for Phantasy Star IV files. Does not modify ROMs directly, instead edits assembly files from lory90's disassembly.

# Dependencies

NodeJS - go to https://nodejs.org to install Node if you don't have it already. The ```node``` command must be in your path.
(optional) git - auto-downloads ps4disasm upon running launcher.js

# Usage

ps4disasm must be in the same directory as all the files contained in this repo. If you don't have it already, make sure git is installed on your system, then run:

```node launcher.js```

You can also launch scripts individually, e.g. ```node ps4snd.js``` to launch ps4snd.
