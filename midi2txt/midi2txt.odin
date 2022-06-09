package midi2eisd
import "core:fmt"
import "core:strings"
import "core:math"
import "core:math/linalg"
import "core:slice"
import "core:strconv"

import "./util"
// import "./audio"

SYM_NOTE :: string("n")
SYM_DURATION :: string("d")

OUT_EXT :: string(".txt")

// This file specifies a ******SEPARATE EXECUTABLE******* from the main code.
// It should compile to a "midi2eisd(.exe)" binary.
// It is used to convert .mid(i) files to .eisd

MIDI_IN :: string("midis")
EISD_OUT :: string("out_txt")

// Glues together the bytes in []u8 such that a proper i32 is formed
// Can also be used for VLQs if they have been (& 0x7F_FF_FF_FF) to remove the sign bit beforehand
glue :: util.glue_u8

// new_midi_channel_context :: proc() -> MidiChannelContext {

// }

// Parses a MIDI file into memory
LINE_DELIM :: string("\n")
MAX_LOOK :: 1000

ParsedMIDI :: string
parse_midi :: proc(dt: string, file_name: string) -> ParsedMIDI {
	_assert :: proc(condition: bool, file_name: string, buf: [dynamic]string, additional_msg: string)
	{
		assert(condition, fmt.aprintf("Could not parse MIDI file %s. %s :: BUF ::\n\n%s", file_name, additional_msg, ""))
	}

	collect_until :: proc(dt: []u8, start: int, look_for: string) -> (int, bool)
	{
		i := 0
		c_state := 0
		i_in_look := -1
		for i < MAX_LOOK {
			if c_state == 0 { // 0 means "we got nothing yet"
				if i > 0 {
					break
				}

				if dt[start + i] == look_for[0] {
					c_state = 1
					i_in_look = 0
				}
			}

			if c_state == 1 { // 1 means "we found the first char; still piecing it together"
				if i_in_look == len(look_for) {
					c_state = 2
					break
				}

				if dt[start + i] != look_for[i_in_look] {
					c_state = 0
					i_in_look = -1
				}

				i_in_look += 1
			}

			i += 1
		}

		if c_state == 2 {
			return start + i, true
		}
		return start + i, false
	}

	collect_bytes :: proc(dt: []u8, start, num_bytes: int) -> ([]u8, int)
	{
		outbuf := make([]u8, num_bytes)
		i := 0
		for ; i < num_bytes; i += 1 {
			outbuf[i] = dt[start + i]
		}
		return outbuf, start + i
	}

	collect_and_glue :: proc(dtbuf: []u8, i, num_bytes: int) -> (i32, int)
	{
		raw: []u8
		k: int

		raw, k = collect_bytes(dtbuf, i, num_bytes)
		return glue(raw), k
	}

	collect_and_glue_vlq :: proc(dt: []u8, start: int) -> (i32, int)
	{
		k := 0
		strbuf := make([dynamic]string)

		for {
			// Make str builder, write base 2 bytes into it
			writable_val := int(dt[start + k]) & 0x7F
			strbuild := strings.make_builder()
			strings.write_int(&strbuild, writable_val, 2)
			append(&strbuf, strings.to_string(strbuild))

			// Pad until always 15 digits
			for len(strbuf[len(strbuf) - 1]) < 15 {
				strbuf[len(strbuf) - 1] = strings.concatenate({ "0", strbuf[len(strbuf) - 1] })
			}

			//fmt.println(strbuf[len(strbuf) - 1])

			strings.destroy_builder(&strbuild)

			if !(dt[start + k] >= 0x80) {
				k += 1
				break
			}
			k += 1
		}

		final_value, worked := strconv.parse_int(strings.join(strbuf[:], ""), 2)
		assert(worked, "Could not convert binary int")
		delete(strbuf)
		return i32(final_value), start + k
	}

	collect_chvoice_event_data :: proc(dt: []u8, start: int, ignore_nn := false) -> (i32, i32, i32, int)
	{
		k := start
		nn, kk, vv: i32

		nn = -1
		if !ignore_nn {
			nn, k = collect_and_glue(dt, k, 1); nn = nn & 0b0000_1111
		}
		kk, k = collect_and_glue(dt, k, 1)
		vv, k = collect_and_glue(dt, k, 1)

		return nn, kk, vv, k
	}

	collect_text_event :: proc(dt: []u8, start: int) -> (int)
	{
		exp_len: i32
		k := 0

		exp_len, k = collect_and_glue_vlq(dt, start)

		_, k = collect_bytes(dt, start, int(exp_len))

		return k + 1
	}

	translate_note :: proc(n: int) -> (string)
	{
		MIDI_NOTES := [12]string{
			"c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b",
		}

		// MIDI midC = 0x3C
		// PSIV midC = 0xBA
		note_off := n - 0x3C
		oct := linalg.floor(f32(note_off) / f32(12)) + 4

		note := ""
		if n > 0x3C {
			note = MIDI_NOTES[note_off % 12]
		} else if n < 0x3C {
			note = MIDI_NOTES[(len(MIDI_NOTES) - 1) - linalg.abs(linalg.abs(note_off) % 12)]
		}

		return fmt.aprintf("%s%i", note, int(oct))
	}

	// There are 2 string output buffers
	// out = body
	// out_header = "$$chan1" + all "fork" commands
	dtbuf := transmute([]u8) dt
	out := make([dynamic]string)
	out_header := make([dynamic]string)

	// First we parse the MThd
	worked: bool
	MThd_length, format, num_tracks, division: i32
	i := int(0)

	// Collect "MThd" text
	i, worked = collect_until(dtbuf, i, "MThd"); _assert(worked, file_name, out, "Could not collect MThd header.")

	// Collect header variables
	MThd_length, i = collect_and_glue(dtbuf, i, 4); i_after_header := int(MThd_length) + i // what i should be post-header
	format, i = collect_and_glue(dtbuf, i, 2)
	num_tracks, i = collect_and_glue(dtbuf, i, 2)
	division, i = collect_and_glue(dtbuf, i, 2)

	// Write global header
	// append(&out, fmt.aprintf("%s %s 1", audio.EISD_SYM_SET, audio.EISD_SETTING_LOOP_ON_END))
	// append(&out, fmt.aprintf("%s %d", audio.EISD_SYM_DIVISION, division))

	// Now deal with division
	_assert(!bool(division & 0x80_00), file_name, out, "MIDI file uses unsupported sign_bit == 1 (SMPTE) timing in the header <division> field. Change to standard MIDI delta time or remove file to proceed.")
	units_per_quarter := int(division)

	// Adjust i so that it should point to the data just after the header, if it is not already there
	i = i_after_header

	// HEADER DONE
	// TRACK PARSING
	track_length, next_dt, current_event_id: i32
	event_byte, status_byte: int
	nn, kk, vv: i32
	last_event: u8

	tempo: i32
	delta_to_frac :: proc(division, delta_units: i32) -> f32 {
		// division = units/quarter (480)
		// raw_tempo = us/quarter (500,000)
		// delta_units = num_units

		// so to get in millisecs, take (raw_tempo / 1,000)
		// 500ms per quarter

		// delta_units specifies what fraction of a quarter a note is.
		// so for 480, 240 is an eighth note
		// so (delta_units / division) gives you the fraction of a quarter note that something is
		fraction_of_quarter_note := f32(f32(delta_units) / f32(division))
		return fraction_of_quarter_note
	}

	current_track := 0
	last_status: int = -1

	for ; current_track < int(num_tracks); current_track += 1 {
		append(&out, "")
		util.debug_print("CURR TRACK %x\n", current_track)
		i, worked = collect_until(dtbuf, i, "MTrk"); _assert(worked, file_name, out, fmt.aprintf("Could not collect MTrk header. Offset: %x", i))
		track_length, i = collect_and_glue(dtbuf, i, 4)

		// Write header for this track
		append(&out, fmt.aprintf("IS TRACK: %d", current_track))

		// If it's the first track, also write out fork commands for the other tracks
		// if current_track == 0 {
		// 	k := 1
		// 	for ; k < int(num_tracks); k += 1 {
		// 		append(&out, fmt.aprintf("fork $$chan%d", k))
		// 	}
		// }

		ending_i := i + int(track_length)
		last_dur := int(-1)
		the_line := false
		for i < ending_i {
			next_dt, i = collect_and_glue_vlq(dtbuf, i) // grab event delta time
			event_byte = int(dtbuf[i])

			this_frac := delta_to_frac(division, next_dt) // fraction of quarter note DTs

			// Running status
			if last_status > -1 && event_byte <= 0x7F {
				event_byte = last_status
			} else {
				last_status = -1
				i += 1 // skip past the event byte
			}

			status_byte = event_byte & 0b1111_0000
			nn = i32(event_byte & 0b0000_1111)

			// MIDI Channel Voice Messages
			if status_byte >= 0x80 && status_byte <= 0xB0 {
				//util.debug_print("STATUS BEFORE %x\n", i)
				_, kk, vv, i = collect_chvoice_event_data(dtbuf, i, true)

				if status_byte == 0x80 || (status_byte == 0x90 && vv < 1) { // NOTE OFF
					// push_chvoice_ev(&out, this_delta, ChanVoiceEvent{ nn, kk, vv, false })
					// append(&out, fmt.aprintf("%s %d %d %f", , nn, kk, this_frac))
					// util.debug_print("NOTE OFF %x\n", i)
				} else if status_byte == 0x90 && vv > 0 { // NOTE ON
					// push_chvoice_ev(&out, this_delta, ChanVoiceEvent{ nn, kk, vv, true })
					append(&out, fmt.aprintf("%s %s", SYM_NOTE, translate_note(cast(int) kk)))
					append(&out, fmt.aprintf("%s 0", SYM_DURATION))
					util.debug_print("NOTE ON %x\n", i)
				} else if status_byte == 0xA0 { // POLYPHONIC KEY PRESSURE
					// DO NOTHING
					util.debug_print("POLY KEY PRESSURE %x\n", i)
				} else if status_byte == 0xB0 { // CONTROLLER CHANGE OR CHANNEL MODE
					if kk <= 0x77 { // CONTROLLER CHANGE
						// DO NOTHING
						util.debug_print("CONTROLLER CHANGE %x\n", i)
					} else { // CHANNEL MODE
						if kk == 0x78 { // TERMINATE ALL SOUND
							// TODO
							util.debug_print("KILL SOUND %x\n", i)
						} else if kk == 0x79 { // RESET ALL CONTROLLERS
							util.debug_print("CONTROLLER RESET %x\n", i)
						} else if kk == 0x7A { // LOCAL CTRL
							util.debug_print("LOCAL CTRL %x\n", i)
						} else if kk == 0x7B { // ALL NOTES OFF
							util.debug_print("KILL NOTES %x\n", i)
						} else if kk == 0x7C { // OMNI MODE OFF
							util.debug_print("OMNI OFF %x\n", i)
						} else if kk == 0x7D { // OMNI MODE ON
							util.debug_print("OMNI ON %x\n", i)
						} else if kk == 0x7E { // MONO ON
							util.debug_print("MONO ON %x\n", i)
						} else if kk == 0x7F { // POLY ON
							util.debug_print("POLY ON %x\n", i)
						}
					}
				}

				last_status = event_byte
			} else if status_byte == 0xC0 { // PRGM CHANGE
				new_instrument: i32; new_instrument, i = collect_and_glue(dtbuf, i, 1)

				// Change instrument
				//append(&out, fmt.aprintf("%s %d %i %f", audio.EISD_SYM_INSTRUMENT, nn, int(new_instrument), this_frac))
				last_status = event_byte
				util.debug_print("PRGM CHANGE %x\n", i)
			} else if status_byte == 0xD0 { // CH PRESSURE
				_, i = collect_bytes(dtbuf, i, 1)

				// DO NOTHING
				last_status = event_byte
				util.debug_print("CHANNEL PRESSURE %x\n", i)
			} else if status_byte == 0xE0 { // PITCH BEND
				_, i = collect_bytes(dtbuf, i, 2)

				// DO NOTHING
				last_status = event_byte
				util.debug_print("PITCH BEND %x\n", i)
			// META events
			} else if event_byte == 0xFF {
				next_byte := dtbuf[i]; i += 1
				if next_byte == 0x00 { // MAYBE SEQ NUMBER???
					next_byte_2 := dtbuf[i]; i += 1
					if next_byte_2 == 0x02 { // SEQ NUMBER
						seq_num: i32
						seq_num, i = collect_and_glue(dtbuf, i, 2)

						// DO NOTHING
						util.debug_print("SEQ NUMBER %x\n", i)
					}
				} else if next_byte >= 0x01 && next_byte <= 0x07 { // TEXT EVENT
					i = collect_text_event(dtbuf, i)
					util.debug_print("TEXT %x\n", i)

					// DO NOTHING
				} else if next_byte == 0x20 { // MIDI CHAN PREFIX
					nb2 := dtbuf[i]; i += 1
					if nb2 == 0x01 { // FILLER
						_, i = collect_bytes(dtbuf, i, 1)
						util.debug_print("MIDI CHAN PREFIX %x\n", i)
					}
				} else if next_byte == 0x21 { // (DEPRECATED) PORT MIDI EVENT
					// It is so fucking retarded that MuseScore exports these.
					// Deprecated event that shouldn't do anything on modern MIDI devices.
					// Literal boomer technology.
					//
					// It took me like 45 minutes to finally figure out that this event was
					// why I was getting midi parse errors...
					nb2 := dtbuf[i]; i += 1
					if nb2 == 0x01 { // FILLER
						_, i = collect_bytes(dtbuf, i, 1)
						util.debug_print("MIDI PORT %x\n", i)
					}
				} else if next_byte == 0x2F { // END TRACK
					nb2 := dtbuf[i]; i += 1
					if nb2 == 0x00 { // FILLER
						util.debug_print("END TRK %x\n", i)

						//append(&out, fmt.aprintf("%s", audio.EISD_SYM_END_TRACK))
						break
					}
				} else if next_byte == 0x51 { // MAYBE TEMPO???
					next_byte_2 := dtbuf[i]; i += 1
					if next_byte_2 == 0x03 { // SET TEMPO
						tempo, i = collect_and_glue(dtbuf, i, 3)
						util.debug_print("TEMPO %x\n", i)

						// Push tempo event
						//append(&out, fmt.aprintf("%s %d %f", audio.EISD_SYM_TEMPO, tempo, this_frac))
					}
				} else if next_byte == 0x54 { // SMPTE Offset
					_, i = collect_bytes(dtbuf, i, 6)

					// DO NOTHING
					util.debug_print("SMPTE OFFSET %x\n", i)
				} else if next_byte == 0x58 { // TIME SIG
					_, i = collect_bytes(dtbuf, i, 5)

					// DO NOTHING
					util.debug_print("TIME SIG %x\n", i)
				} else if next_byte == 0x59 { // KEY SIG
					_, i = collect_bytes(dtbuf, i, 3)

					// DO NOTHING
					util.debug_print("KEY SIG %x\n", i)
				}

				last_status = -1
			}
		}
	}

	return strings.join(slice.concatenate([][]string{ out_header[:], out[:] }), "\n")
}

// Reads midi files into internal string buffer
main :: proc() {
	// Grab all midis in the midis folder, and parse them individually.
	midis := util.read_dir(MIDI_IN)
	for midi_file in midis {
		fext := util.ext(midi_file.name)
		if fext == ".mid" || fext == ".midi" {
			file_data, worked := util.get_file(util.path_join({ MIDI_IN, midi_file.name }))
			assert(worked, fmt.aprintf("midi2eisd main: Could not get midi file %s. Check that it exists and is not corrupt.", midi_file.name))

			eisd_out := parse_midi(file_data, midi_file.name)
			util.write_string(util.path_join({ EISD_OUT, strings.concatenate({ util.stem(midi_file.name), OUT_EXT }) }), eisd_out)
		}
	}
}