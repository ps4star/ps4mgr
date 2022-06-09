package util
import "core:fmt"
import "core:strings"
import "core:math"
import "core:intrinsics"
import "core:strconv"

pow_f32 :: proc(base: f32, pow: int) -> (f32)
{
	res := f32(1)
	for j in 0..<pow {
		res *= base
	}
	return res
}

glue_u8 :: proc(nums: []u8, power := 256) -> (i32)
{
	res := i32(0)
	l := len(nums)
	for num, i in nums {
		res += i32(num) * i32(pow_f32(f32(power), (l - i) - 1))
	}
	return res
}

FLOAT_EQ_RANGE :: 0.0005
float_is_equal_to :: proc(n: $T, n2: $A) -> (bool)
		where intrinsics.type_is_float(T),
		intrinsics.type_is_float(A),
		T == A
{
	return n >= (n2 + (-1 * FLOAT_EQ_RANGE)) && n <= (n2 + FLOAT_EQ_RANGE)
}

parse_int :: proc(n: string) -> (int)
{
	val, worked := strconv.parse_int(n)
	assert(worked)

	return val
}

parse_f32 :: proc(n: string) -> (f32)
{
	val, worked := strconv.parse_f32(n)
	assert(worked)

	return val
}