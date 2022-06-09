package util
import "core:fmt"
import "core:intrinsics"
import "core:strconv"
import "core:strings"

// Contains all code relating to Uprefs (user preferences). These are always stored as key=value pairs in the file "settings.def"
SETTINGS_PATH :: string("./settings.def")

// Create uprefs map
UprefsMap :: map[string]string
umap := make(UprefsMap)

// Init the uprefs system (load file, etc)
uprefs_init :: proc()
{
	uprefs_file, worked := get_file_static(SETTINGS_PATH)
	assert(worked, fmt.aprintf("Could not load %s file. Ensure it exists.", SETTINGS_PATH))

	// parse file
	lines := strings.split(uprefs_file, "\n")
	for line, i in lines {
		args := strings.split(line, "=")
		umap[args[0]] = strings.join(args[1:], "=")
	}
}

// Check if field exists in uprefs
uprefs_has :: proc(name: string) -> (bool)
{
	return (name in umap)
}

@private
uprefs_get_int :: proc(name: string, $T: typeid, base := int(10)) -> (T)
	where !intrinsics.type_is_unsigned(T), // must be signed and an int
		intrinsics.type_is_integer(T)
{
	if !uprefs_has(name) {
		return cast(T) -1
	}

	str_data := umap[name]
	val, worked := strconv.parse_int(str_data, base)
	assert(worked, fmt.aprintf("Could not get upref %s :: cannot convert to desired signed integer type.", name))
	return cast(T) val
}

@private
uprefs_get_uint :: proc(name: string, $T: typeid, base := int(10)) -> (T)
	where intrinsics.type_is_unsigned(T), // must be unsigned and an int
		intrinsics.type_is_integer(T)
{
	if !uprefs_has(name) {
		return cast(T) -1
	}

	str_data := umap[name]
	val, worked := strconv.parse_uint(str_data, base)
	assert(worked, fmt.aprintf("Could not get upref %s :: cannot convert to desired unsigned integer type.", name))
	return cast(T) val
}

@private
uprefs_get_f32 :: proc(name: string) -> (f32)
{
	if !uprefs_has(name) {
		return f32(0)
	}

	str_data := umap[name]
	val, worked := strconv.parse_f32(str_data)
	assert(worked, fmt.aprintf("Could not get upref %s :: cannot convert to desired f16 or f32 type.", name))
	return val
}

// Get a upref. Interpret as the given type, otherwise returns a string.
uprefs_get :: proc
{
	uprefs_get_int,
	uprefs_get_uint,
	uprefs_get_f32,
}