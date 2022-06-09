# Writeup on PSIV sound engine/music format

### Where to find the music

In your ps4disasm folder, go to `sound/ps4.sound_driver.asm`. This has note data for every song in the game.

### Duration bytes

If a byte is between `00` and `0x7F` then it is interpreted as a duration byte. This duration is held onto as a sort of running status, so that every subsequent note will have the same duration, until another duration byte is specified (this saves space).

### Note bytes

If a byte is between `80` and `DF` then it is interpreted as a note byte. The duration of the note is always specified directly after the note byte, unless using the same duration as the last note where duration was explicitly stated, in which case it is omitted.

### Command bytes

If a byte is between `E0` and `FF` then it is a special command. These can take 0 or more arguments (additional bytes) directly after the command byte. For example, `MOD_SETUP` or `F0` uses up 5 bytes total (4 argument bytes), and `HOLD` or `F7` takes 0 arguments, using only the 1 byte for the command ID.

#### List of commands

This can be found in `DefCFlag.txt` in the `sound/` dir in the ps4disasm. But I'll elaborate on that documentation here since it isn't clear in the disasm.

```
E0	PANAFMS 	PAFMS_PAN	02	-	Takes 1 args; probably has something to do with panning, but idk, needs to be tested.
E1	DETUNE  	        	02	-	Takes 1 args; probably something to do with pitch/tuning, but idk, needs to be tested.
E2	SET_COMM	        	02	-	Takes 1 args; idk.
E3	DAC_PS4 	PS4_VOLCTRL	02	-	Takes 1 args; I think this has something to do with volume.
E4	DAC_PS4 	PS4_LOOP	02	-	Takes 1 args; No idea what this does since there's another loop command that actually loops the song.
E5	VOLUME  	VOL_NN_FMP	03	-	Takes 2 args; idk why there are like 4 volume commands. Idk the differences.
E6	VOLUME  	VOL_NN_FM	02	-	Takes 1 args; another volume command.
E7	HOLD    	        	01	-	Takes 0 args; extends duration of last note. Usually followed by a duration byte, if not then uses running byte.
E8	NOTE_STOP	NSTOP_NORMAL	02  Takes 1 arg; this probably cuts off a note immediately.
E9	SET_LFO 	LFO_AMSEN	03	-	Takes 2 args; no idea.
EA	TEMPO   	TEMPO_SET	02	-	Takes 1 arg; probably sets the speed of the song. Not sure the format of this, will look into it though.
EB	SND_CMD 	        	02	-	Takes 1 arg; no idea.
EC	VOLUME  	VOL_NN_PSG	02	-	Takes 1 arg; no idea, probably volume but not sure why this specifically and not other volume cmds.
ED	PANAFMS 	PAFMS_PAN	02	-	Takes 1 arg; probably something to do with panning, idk.
EE	DAC_PS4 	PS4_SET_SND	02	-	Takes 1 arg; no idea.
EF	INSTRUMENT	INS_N_FM	02	-	Takes 1 arg; sets intrument ID of track.
F0	MOD_SETUP	        	05	-	Takes 4 args; no idea, will test though.
F1	MOD_ENV 	MENV_FMP	03	-	Takes 2 args; no idea.
F2	TRK_END 	TEND_STD	01	-	Takes 0 args; specifies end of track.
F3	PSG_NOISE	PNOIS_SET	02	-	Takes 1 arg; no idea.
F4	MOD_ENV 	MENV_GEN	02	-	Takes 1 arg; no idea.
F5	INSTRUMENT	INS_N_PSG	02	-	Takes 1 arg; presumably sets instrument too, but idk what the difference is.
F6	GOTO    	        	03	01  Takes 2 args; jumps to another part of the data.
F7	LOOP    	        	05	03  Takes 4 args; specifies beginning and end of loop points as 16-bit integers each.
F8	GOSUB   	        	03	01  Takes 2 args; relative jump to another part of the data. This also sets up the ability to use F9/RETURN later.
F9	RETURN  	        	01	-	Takes 0 args; returns back to right after the last GOSUB command.
FA	DAC_PS4 	PS4_REVERSE	02	-	Takes 1 arg; no idea.
FB	TRANSPOSE	TRNSP_ADD	02	-	Takes 1 arg; not sure, imagine it might offset note IDs.
; Note: linear volume, 00h (silent) .. 10h (normal)
;       Final Sample = Sample * Volume / 10h
FC	DAC_PS4 	PS4_VOLUME	02	-	Takes 1 arg; not sure the difference between this and other vol commands.
FD	DAC_PS4 	PS4_TRKMODE	02	-	Takes 1 arg; specifies track mode, not sure what that means.
FE	SPC_FM3 	        	05	-	Takes 4 args; no idea.
FF	META_CF 	        	01	-	Takes 0 args; no idea.
```

### Example Analysis

Melody of `MotabiaTown` theme.

```
loc_D297E:
	dc.b	$EF, $04, $E0, $40, $F0, $1B, $01, $04, $04, $F8, $00, $3A, $C6, $30, $E7, $30
	dc.b	$E6, $FE, $EF, $01, $F0, $01, $01, $04, $02, $D2, $24, $D1, $06, $CF, $D2, $18
	dc.b	$D4, $0C, $D2, $D1, $06, $D2, $D1, $CD, $1E, $E7, $18, $CF, $0C, $D1, $D2, $24
	dc.b	$D1, $06, $CF, $D2, $18, $D4, $0C, $D2, $D1, $06, $D2, $D1, $CD, $1E, $E7, $30
	dc.b	$E6, $02, $F6, $FF, $BC, $CA, $24, $C8, $06, $C6, $C8, $18, $CD, $0C, $CB, $06 ; starting line, starts at +0x05
	dc.b	$CA, $C8, $CA, $C6, $24, $E7, $30, $C8, $08, $CA, $C6, $18, $E7, $08, $E7, $18
	dc.b	$C5, $12, $C6, $06, $C8, $CA, $24, $E7, $06, $C8, $30, $CA, $24, $C8, $06, $C6
	dc.b	$C8, $18, $CD, $0C, $CB, $06, $CA, $C8, $CA, $C6, $24, $E7, $30, $C8, $08, $CA
	dc.b	$C6, $18, $E7, $08, $E7, $18, $C5, $12, $C6, $06
	dc.b	$F9
```

First, we have a long list of special 0xE0+ commands. For some reason, this particular audio track jumps around a lot. The starting note data isn't actually the beginning of the song; it jumps exactly 0x3A bytes forward initially (this is what `F8 00 3A` means).

Where the notes start is the 5th line of note data:

`$CA, $24, $C8, $06, $C6, $C8, $18, $CD, $0C, $CB, $06, $CA, $C8, $CA, $C6, $24`

These are the first few notes of the motavia town theme melody. Really think about what that sounds like while reading the bytes. Also remember that the lower bytes (24, 06, 18) are all duration specifiers. If we try to visualise the rhythm here, we'd get something like

`$CA------ $C8- $C6- $C8---- $CD-- $CB- $CA- $C8- $CA- $C6------`

Keep in mind that `$BA` is middle C, and the full note range is `80` to `DF`.

After this, there are some more notes for a while, some hold commands, and finally an `F9` return. This goes back to after the last `F8` (GOSUB) command that was called. So in this case, we go to the first line of data and start playing from `C6 30 E7 30...`. Right after, we get some commands like INSTRUMENT, SPC_FM3 etc to setup the sound for the next section of the song (you'll notice the melody sound changes after the first part of the song; this is why).

### Text Format

Using ps4mgr/ps4snd.js, it is possible to extract music data into a more human-friendly text format. This way you can see what the data actually does. Here's the raw data of the melody of MotabiaTown again:

```
loc_D297E:
	dc.b	$EF, $04, $E0, $40, $F0, $1B, $01, $04, $04, $F8, $00, $3A, $C6, $30, $E7, $30
	dc.b	$E6, $FE, $EF, $01, $F0, $01, $01, $04, $02, $D2, $24, $D1, $06, $CF, $D2, $18
	dc.b	$D4, $0C, $D2, $D1, $06, $D2, $D1, $CD, $1E, $E7, $18, $CF, $0C, $D1, $D2, $24
	dc.b	$D1, $06, $CF, $D2, $18, $D4, $0C, $D2, $D1, $06, $D2, $D1, $CD, $1E, $E7, $30
	dc.b	$E6, $02, $F6, $FF, $BC, $CA, $24, $C8, $06, $C6, $C8, $18, $CD, $0C, $CB, $06 ; starting line, starts at +0x05
	dc.b	$CA, $C8, $CA, $C6, $24, $E7, $30, $C8, $08, $CA, $C6, $18, $E7, $08, $E7, $18
	dc.b	$C5, $12, $C6, $06, $C8, $CA, $24, $E7, $06, $C8, $30, $CA, $24, $C8, $06, $C6
	dc.b	$C8, $18, $CD, $0C, $CB, $06, $CA, $C8, $CA, $C6, $24, $E7, $30, $C8, $08, $CA
	dc.b	$C6, $18, $E7, $08, $E7, $18, $C5, $12, $C6, $06
	dc.b	$F9
```

And here's the same data in text format (`node ps4snd.js x -f txt MotabiaTown`):

```
.section MAIN
-:

loc_D297E:
	instrument 04
	pan 40
	mod_setup 1B 01 04 04
	gosub +
	n c5
	d 48
	hold
	d 48
	vol_fm FE
	instrument 01
	mod_setup 01 01 04 02
	n c6
	d 36
	n b5
	d 6
	n a5
	n c6
	d 24
	n d6
	d 12
	n c6
	n b5
	d 6
	n c6
	n b5
	n g5
	d 30
	hold
	d 24
	n a5
	d 12
	n b5
	n c6
	d 36
	n b5
	d 6
	n a5
	n c6
	d 24
	n d6
	d 12
	n c6
	n b5
	d 6
	n c6
	n b5
	n g5
	d 30
	hold
	d 48
	vol_fm 02
	goto -
---:
-------:
+:
	n e5
	d 36
	n d5
	d 6
	n c5
	n d5
	d 24
	n g5
	d 12
	n f5
	d 6
	n e5
	n d5
	n e5
	n c5
	d 36
	hold
	d 48
	n d5
	d 8
	n e5
	n c5
	d 24
	hold
	d 8
	hold
	d 24
	n b4
	d 18
	n c5
	d 6
	n d5
	n e5
	d 36
	hold
	d 6
	n d5
	d 48
	n e5
	d 36
	n d5
	d 6
	n c5
	n d5
	d 24
	n g5
	d 12
	n f5
	d 6
	n e5
	n d5
	n e5
	n c5
	d 36
	hold
	d 48
	n d5
	d 8
	n e5
	n c5
	d 24
	hold
	d 8
	hold
	d 24
	n b4
	d 18
	n c5
	d 6
	return
```

(you can also put extracted text data back into the ASM with `node ps4snd.js r -f txt MotabiaTown.txt`)