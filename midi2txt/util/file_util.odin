package util
import "core:fmt"
import "core:strings"
import "core:os"
import "core:path/filepath"

STATICRES :: "staticres"

has_init := false
base_path: string

path_join :: filepath.join
init_io :: proc()
{
	has_init = true
	worked: bool; base_path, worked = filepath.abs(os.args[0])
	assert(worked, fmt.aprintf("Could not initialize IO. Failed on converting os.args[0] to absolute path. Since this path should always exist, you should never see this error unless something is horribly wrong with your OS."))
}

@private
require_init :: proc()
{
	if has_init { return }
	init_io()
}

get_base :: proc() -> (string)
{
	require_init()
	return filepath.dir(base_path)
}

get_static :: proc() -> (string)
{
	return path_join({ get_base(), STATICRES })
}

path_from_base :: proc(path: string) -> (string)
{
	return path_join({ get_base(), path })
}

path_from_static :: proc(path: string) -> (string)
{
	return path_join({ get_static(), path })
}

// Basic "read string from file and return" function.
// Returns the file contents and a bool saying whether it worked
get_file_global :: proc(path: string, normalize := true) -> (string, bool)
{
	res, worked := os.read_entire_file_from_filename(path)
	if !worked { return "", false }

	// If we aren't normalizing then we can go ahead and just return now
	if !normalize { return cast(string) res, true }

	res_as_str := cast(string) res
	res_as_str, worked = strings.replace_all(res_as_str, "\r\n", "\n") // normalize to unix
	return res_as_str, true
}

get_file :: proc(path: string, normalize := true) -> (string, bool) { return get_file_global(path_from_base(path), normalize) }
get_file_static :: proc(path: string, normalize := true) -> (string, bool) { return get_file_global(path_from_static(path), normalize) }

file_exists_raw :: proc(path: string) -> (bool)
{
	return os.file_size_from_path(path) == -1
}

file_exists_from_base :: proc(path: string) -> (bool) { return file_exists_raw(path_from_base(path)) }
file_exists_static :: proc(path: string) -> (bool) { return file_exists_raw(path_from_static(path)) }

READ_DIR_FAIL_STIRNG :: string("Could not read dir %s.")

File_Info :: os.File_Info

// Base dir read function
// Returns nil on error
read_dir_global :: proc(path: string) -> ([]File_Info)
{
	fd, err := os.open(path)
	if bool(err) { return nil }
	dir, dir_err := os.read_dir(fd, -1)
	if bool(err) { return nil }

	os.close(fd)
	return dir
}

read_dir :: proc(path: string) -> ([]File_Info) { return read_dir_global(path_from_base(path)) }
read_dir_static :: proc(path: string) -> ([]File_Info) { return read_dir_global(path_from_static(path)) }

write_string :: proc(path, data: string)
{
	assert(os.write_entire_file(path_from_base(path), transmute([]u8) data), fmt.aprintf("Couldn't write file %s.", path))
}

stem :: filepath.stem
ext :: filepath.ext