package util
import "core:fmt"
import "core:strings"

// Printing utils
debug := false
debug_print :: proc(str: string, args: ..any)
{
	if !debug { return }
	fmt.printf(str, args)
}