
import { memGetSoftSwitch, memSetSoftSwitch, memGet, memSet } from "../memory"

//    765432107654321076543210765432107654321076543210
//    0-------1-------2-------3-------4-------5-------+
// S  + ****  +       +       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    0-------1-------2-------3-------4-------5-------+
// D  +S****EE+       +       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 4
//    Source Shift = 1
//    Dest   Shift = 1
//    Shift = 0
//    Source Length = 1
//    Dest   Length = 1
//   
//    0-------1-------2-------3-------4-------5-------+
// S  + ******+**     +       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    0-------1-------2-------3-------4-------5-------+
// D  +SSS****+****EEE+       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 8
//    Source Shift = 1
//    Dest   Shift = 3
//    Shift = +2
//    Source Length = 2
//    Dest   Length = 2
//
//    0-------1-------2-------3-------4-------5-------+
// S  +*******+xxxxxxx+       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    0-------1-------2-------3-------4-------5-------+
// D  +SSS****+***EEEE+       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 7
//    Source Shift = 0
//    Dest   Shift = 3
//    Shift = +3
//    Source Length = 1/2
//    Dest   Length = 2
//
//            0-------1-------2-------3-------4-------+
// S          +   ****+***    +       +       +       +
//            +-------+-------+-------+-------+-------+
//            0-------1-------2-------3-------4-------+
// D          +*******+       +       +       +       +
//            +-------+-------+-------+-------+-------+
//   -1-------0-------1-------2-------3-------4-------+
// D  +       +*******+       +       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 7
//    Source Shift = 3
//    Dest   Shift = 0
//    Shift = -3/+4
//    Source Length = 2
//    Dest   Length = 1/2
//   
//            0-------1-------2-------3-------4-------+
// S          +     **+*****  +xxxxxxx+       +       +
//            +-------+-------+-------+-------+-------+
//            0-------1-------2-------3-------4-------+
// D          +SSS****+***EEEE+       +       +       +
//            +-------+-------+-------+-------+-------+
//   -1-------0-------1-------2-------3-------4-------+
// D  +xxxxxxx+SSS****+***EEEE+       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 7
//    Source Shift = 5
//    Dest   Shift = 3/10
//    Shift = -2/+5
//    Source Length = 2/3
//    Dest   Length = 2/3
//
//            0-------1-------2-------3-------4-------+
// S          +      *+****** +xxxxxxx+       +       +
//            +-------+-------+-------+-------+-------+
//            0-------1-------2-------3-------4-------+
// D          +S******+*EEEEEE+       +       +       +
//            +-------+-------+-------+-------+-------+
//   -1-------0-------1-------2-------3-------4-------+
// D  +xxxxxxx+S******+*EEEEEE+       +       +       +
//    +-------+-------+-------+-------+-------+-------+
//    Bit Length = 7
//    Source Shift = 6
//    Dest   Shift = 1/8
//    Shift = -5/+2
//    Source Length = 2/3
//    Dest   Length = 2/3

//      a0  m0  a1  m1  a2
//  A0--M0--A1--M1--A2--M2
//  00  01  02  03  04  05
//
//C    m0 m1  a0 a1 a2
//  A0 A1 A2  M0 M1 M2
//  00 02 04  01 03 05
//
class shiftent
{
  val : number;
  carry : number;
}

const shiftmask: readonly shiftent[8] = [
 { val: 0xff, carry: 0xff },
 { val: 0xfe, carry: 0x81 },
 { val: 0xfc, carry: 0x83 },
 { val: 0xf8, carry: 0x87 },
 { val: 0xf0, carry: 0x8f },
 { val: 0xe0, carry: 0x9f },
 { val: 0xc0, carry: 0xbf },
 { val: 0x80, carry: 0x80 }
];

const shr1: readonly shiftent[] = [
 { val:0x0, carry:0x0}, // 0x0
 { val:0x2, carry:0x0}, // 0x1
 { val:0x4, carry:0x0}, // 0x2
 { val:0x6, carry:0x0}, // 0x3
 { val:0x8, carry:0x0}, // 0x4
 { val:0xa, carry:0x0}, // 0x5
 { val:0xc, carry:0x0}, // 0x6
 { val:0xe, carry:0x0}, // 0x7
 { val:0x10, carry:0x0}, // 0x8
 { val:0x12, carry:0x0}, // 0x9
 { val:0x14, carry:0x0}, // 0xa
 { val:0x16, carry:0x0}, // 0xb
 { val:0x18, carry:0x0}, // 0xc
 { val:0x1a, carry:0x0}, // 0xd
 { val:0x1c, carry:0x0}, // 0xe
 { val:0x1e, carry:0x0}, // 0xf
 { val:0x20, carry:0x0}, // 0x10
 { val:0x22, carry:0x0}, // 0x11
 { val:0x24, carry:0x0}, // 0x12
 { val:0x26, carry:0x0}, // 0x13
 { val:0x28, carry:0x0}, // 0x14
 { val:0x2a, carry:0x0}, // 0x15
 { val:0x2c, carry:0x0}, // 0x16
 { val:0x2e, carry:0x0}, // 0x17
 { val:0x30, carry:0x0}, // 0x18
 { val:0x32, carry:0x0}, // 0x19
 { val:0x34, carry:0x0}, // 0x1a
 { val:0x36, carry:0x0}, // 0x1b
 { val:0x38, carry:0x0}, // 0x1c
 { val:0x3a, carry:0x0}, // 0x1d
 { val:0x3c, carry:0x0}, // 0x1e
 { val:0x3e, carry:0x0}, // 0x1f
 { val:0x40, carry:0x0}, // 0x20
 { val:0x42, carry:0x0}, // 0x21
 { val:0x44, carry:0x0}, // 0x22
 { val:0x46, carry:0x0}, // 0x23
 { val:0x48, carry:0x0}, // 0x24
 { val:0x4a, carry:0x0}, // 0x25
 { val:0x4c, carry:0x0}, // 0x26
 { val:0x4e, carry:0x0}, // 0x27
 { val:0x50, carry:0x0}, // 0x28
 { val:0x52, carry:0x0}, // 0x29
 { val:0x54, carry:0x0}, // 0x2a
 { val:0x56, carry:0x0}, // 0x2b
 { val:0x58, carry:0x0}, // 0x2c
 { val:0x5a, carry:0x0}, // 0x2d
 { val:0x5c, carry:0x0}, // 0x2e
 { val:0x5e, carry:0x0}, // 0x2f
 { val:0x60, carry:0x0}, // 0x30
 { val:0x62, carry:0x0}, // 0x31
 { val:0x64, carry:0x0}, // 0x32
 { val:0x66, carry:0x0}, // 0x33
 { val:0x68, carry:0x0}, // 0x34
 { val:0x6a, carry:0x0}, // 0x35
 { val:0x6c, carry:0x0}, // 0x36
 { val:0x6e, carry:0x0}, // 0x37
 { val:0x70, carry:0x0}, // 0x38
 { val:0x72, carry:0x0}, // 0x39
 { val:0x74, carry:0x0}, // 0x3a
 { val:0x76, carry:0x0}, // 0x3b
 { val:0x78, carry:0x0}, // 0x3c
 { val:0x7a, carry:0x0}, // 0x3d
 { val:0x7c, carry:0x0}, // 0x3e
 { val:0x7e, carry:0x0}, // 0x3f
 { val:0x0, carry:0x1}, // 0x40
 { val:0x2, carry:0x1}, // 0x41
 { val:0x4, carry:0x1}, // 0x42
 { val:0x6, carry:0x1}, // 0x43
 { val:0x8, carry:0x1}, // 0x44
 { val:0xa, carry:0x1}, // 0x45
 { val:0xc, carry:0x1}, // 0x46
 { val:0xe, carry:0x1}, // 0x47
 { val:0x10, carry:0x1}, // 0x48
 { val:0x12, carry:0x1}, // 0x49
 { val:0x14, carry:0x1}, // 0x4a
 { val:0x16, carry:0x1}, // 0x4b
 { val:0x18, carry:0x1}, // 0x4c
 { val:0x1a, carry:0x1}, // 0x4d
 { val:0x1c, carry:0x1}, // 0x4e
 { val:0x1e, carry:0x1}, // 0x4f
 { val:0x20, carry:0x1}, // 0x50
 { val:0x22, carry:0x1}, // 0x51
 { val:0x24, carry:0x1}, // 0x52
 { val:0x26, carry:0x1}, // 0x53
 { val:0x28, carry:0x1}, // 0x54
 { val:0x2a, carry:0x1}, // 0x55
 { val:0x2c, carry:0x1}, // 0x56
 { val:0x2e, carry:0x1}, // 0x57
 { val:0x30, carry:0x1}, // 0x58
 { val:0x32, carry:0x1}, // 0x59
 { val:0x34, carry:0x1}, // 0x5a
 { val:0x36, carry:0x1}, // 0x5b
 { val:0x38, carry:0x1}, // 0x5c
 { val:0x3a, carry:0x1}, // 0x5d
 { val:0x3c, carry:0x1}, // 0x5e
 { val:0x3e, carry:0x1}, // 0x5f
 { val:0x40, carry:0x1}, // 0x60
 { val:0x42, carry:0x1}, // 0x61
 { val:0x44, carry:0x1}, // 0x62
 { val:0x46, carry:0x1}, // 0x63
 { val:0x48, carry:0x1}, // 0x64
 { val:0x4a, carry:0x1}, // 0x65
 { val:0x4c, carry:0x1}, // 0x66
 { val:0x4e, carry:0x1}, // 0x67
 { val:0x50, carry:0x1}, // 0x68
 { val:0x52, carry:0x1}, // 0x69
 { val:0x54, carry:0x1}, // 0x6a
 { val:0x56, carry:0x1}, // 0x6b
 { val:0x58, carry:0x1}, // 0x6c
 { val:0x5a, carry:0x1}, // 0x6d
 { val:0x5c, carry:0x1}, // 0x6e
 { val:0x5e, carry:0x1}, // 0x6f
 { val:0x60, carry:0x1}, // 0x70
 { val:0x62, carry:0x1}, // 0x71
 { val:0x64, carry:0x1}, // 0x72
 { val:0x66, carry:0x1}, // 0x73
 { val:0x68, carry:0x1}, // 0x74
 { val:0x6a, carry:0x1}, // 0x75
 { val:0x6c, carry:0x1}, // 0x76
 { val:0x6e, carry:0x1}, // 0x77
 { val:0x70, carry:0x1}, // 0x78
 { val:0x72, carry:0x1}, // 0x79
 { val:0x74, carry:0x1}, // 0x7a
 { val:0x76, carry:0x1}, // 0x7b
 { val:0x78, carry:0x1}, // 0x7c
 { val:0x7a, carry:0x1}, // 0x7d
 { val:0x7c, carry:0x1}, // 0x7e
 { val:0x7e, carry:0x1}, // 0x7f
 { val:0x80, carry:0x0}, // 0x80
 { val:0x82, carry:0x0}, // 0x81
 { val:0x84, carry:0x0}, // 0x82
 { val:0x86, carry:0x0}, // 0x83
 { val:0x88, carry:0x0}, // 0x84
 { val:0x8a, carry:0x0}, // 0x85
 { val:0x8c, carry:0x0}, // 0x86
 { val:0x8e, carry:0x0}, // 0x87
 { val:0x90, carry:0x0}, // 0x88
 { val:0x92, carry:0x0}, // 0x89
 { val:0x94, carry:0x0}, // 0x8a
 { val:0x96, carry:0x0}, // 0x8b
 { val:0x98, carry:0x0}, // 0x8c
 { val:0x9a, carry:0x0}, // 0x8d
 { val:0x9c, carry:0x0}, // 0x8e
 { val:0x9e, carry:0x0}, // 0x8f
 { val:0xa0, carry:0x0}, // 0x90
 { val:0xa2, carry:0x0}, // 0x91
 { val:0xa4, carry:0x0}, // 0x92
 { val:0xa6, carry:0x0}, // 0x93
 { val:0xa8, carry:0x0}, // 0x94
 { val:0xaa, carry:0x0}, // 0x95
 { val:0xac, carry:0x0}, // 0x96
 { val:0xae, carry:0x0}, // 0x97
 { val:0xb0, carry:0x0}, // 0x98
 { val:0xb2, carry:0x0}, // 0x99
 { val:0xb4, carry:0x0}, // 0x9a
 { val:0xb6, carry:0x0}, // 0x9b
 { val:0xb8, carry:0x0}, // 0x9c
 { val:0xba, carry:0x0}, // 0x9d
 { val:0xbc, carry:0x0}, // 0x9e
 { val:0xbe, carry:0x0}, // 0x9f
 { val:0xc0, carry:0x0}, // 0xa0
 { val:0xc2, carry:0x0}, // 0xa1
 { val:0xc4, carry:0x0}, // 0xa2
 { val:0xc6, carry:0x0}, // 0xa3
 { val:0xc8, carry:0x0}, // 0xa4
 { val:0xca, carry:0x0}, // 0xa5
 { val:0xcc, carry:0x0}, // 0xa6
 { val:0xce, carry:0x0}, // 0xa7
 { val:0xd0, carry:0x0}, // 0xa8
 { val:0xd2, carry:0x0}, // 0xa9
 { val:0xd4, carry:0x0}, // 0xaa
 { val:0xd6, carry:0x0}, // 0xab
 { val:0xd8, carry:0x0}, // 0xac
 { val:0xda, carry:0x0}, // 0xad
 { val:0xdc, carry:0x0}, // 0xae
 { val:0xde, carry:0x0}, // 0xaf
 { val:0xe0, carry:0x0}, // 0xb0
 { val:0xe2, carry:0x0}, // 0xb1
 { val:0xe4, carry:0x0}, // 0xb2
 { val:0xe6, carry:0x0}, // 0xb3
 { val:0xe8, carry:0x0}, // 0xb4
 { val:0xea, carry:0x0}, // 0xb5
 { val:0xec, carry:0x0}, // 0xb6
 { val:0xee, carry:0x0}, // 0xb7
 { val:0xf0, carry:0x0}, // 0xb8
 { val:0xf2, carry:0x0}, // 0xb9
 { val:0xf4, carry:0x0}, // 0xba
 { val:0xf6, carry:0x0}, // 0xbb
 { val:0xf8, carry:0x0}, // 0xbc
 { val:0xfa, carry:0x0}, // 0xbd
 { val:0xfc, carry:0x0}, // 0xbe
 { val:0xfe, carry:0x0}, // 0xbf
 { val:0x80, carry:0x1}, // 0xc0
 { val:0x82, carry:0x1}, // 0xc1
 { val:0x84, carry:0x1}, // 0xc2
 { val:0x86, carry:0x1}, // 0xc3
 { val:0x88, carry:0x1}, // 0xc4
 { val:0x8a, carry:0x1}, // 0xc5
 { val:0x8c, carry:0x1}, // 0xc6
 { val:0x8e, carry:0x1}, // 0xc7
 { val:0x90, carry:0x1}, // 0xc8
 { val:0x92, carry:0x1}, // 0xc9
 { val:0x94, carry:0x1}, // 0xca
 { val:0x96, carry:0x1}, // 0xcb
 { val:0x98, carry:0x1}, // 0xcc
 { val:0x9a, carry:0x1}, // 0xcd
 { val:0x9c, carry:0x1}, // 0xce
 { val:0x9e, carry:0x1}, // 0xcf
 { val:0xa0, carry:0x1}, // 0xd0
 { val:0xa2, carry:0x1}, // 0xd1
 { val:0xa4, carry:0x1}, // 0xd2
 { val:0xa6, carry:0x1}, // 0xd3
 { val:0xa8, carry:0x1}, // 0xd4
 { val:0xaa, carry:0x1}, // 0xd5
 { val:0xac, carry:0x1}, // 0xd6
 { val:0xae, carry:0x1}, // 0xd7
 { val:0xb0, carry:0x1}, // 0xd8
 { val:0xb2, carry:0x1}, // 0xd9
 { val:0xb4, carry:0x1}, // 0xda
 { val:0xb6, carry:0x1}, // 0xdb
 { val:0xb8, carry:0x1}, // 0xdc
 { val:0xba, carry:0x1}, // 0xdd
 { val:0xbc, carry:0x1}, // 0xde
 { val:0xbe, carry:0x1}, // 0xdf
 { val:0xc0, carry:0x1}, // 0xe0
 { val:0xc2, carry:0x1}, // 0xe1
 { val:0xc4, carry:0x1}, // 0xe2
 { val:0xc6, carry:0x1}, // 0xe3
 { val:0xc8, carry:0x1}, // 0xe4
 { val:0xca, carry:0x1}, // 0xe5
 { val:0xcc, carry:0x1}, // 0xe6
 { val:0xce, carry:0x1}, // 0xe7
 { val:0xd0, carry:0x1}, // 0xe8
 { val:0xd2, carry:0x1}, // 0xe9
 { val:0xd4, carry:0x1}, // 0xea
 { val:0xd6, carry:0x1}, // 0xeb
 { val:0xd8, carry:0x1}, // 0xec
 { val:0xda, carry:0x1}, // 0xed
 { val:0xdc, carry:0x1}, // 0xee
 { val:0xde, carry:0x1}, // 0xef
 { val:0xe0, carry:0x1}, // 0xf0
 { val:0xe2, carry:0x1}, // 0xf1
 { val:0xe4, carry:0x1}, // 0xf2
 { val:0xe6, carry:0x1}, // 0xf3
 { val:0xe8, carry:0x1}, // 0xf4
 { val:0xea, carry:0x1}, // 0xf5
 { val:0xec, carry:0x1}, // 0xf6
 { val:0xee, carry:0x1}, // 0xf7
 { val:0xf0, carry:0x1}, // 0xf8
 { val:0xf2, carry:0x1}, // 0xf9
 { val:0xf4, carry:0x1}, // 0xfa
 { val:0xf6, carry:0x1}, // 0xfb
 { val:0xf8, carry:0x1}, // 0xfc
 { val:0xfa, carry:0x1}, // 0xfd
 { val:0xfc, carry:0x1}, // 0xfe
 { val:0xfe, carry:0x1}, // 0xff
];

const shr2: readonly shiftent[] = [
 { val:0x0, carry:0x0}, // 0x0
 { val:0x4, carry:0x0}, // 0x1
 { val:0x8, carry:0x0}, // 0x2
 { val:0xc, carry:0x0}, // 0x3
 { val:0x10, carry:0x0}, // 0x4
 { val:0x14, carry:0x0}, // 0x5
 { val:0x18, carry:0x0}, // 0x6
 { val:0x1c, carry:0x0}, // 0x7
 { val:0x20, carry:0x0}, // 0x8
 { val:0x24, carry:0x0}, // 0x9
 { val:0x28, carry:0x0}, // 0xa
 { val:0x2c, carry:0x0}, // 0xb
 { val:0x30, carry:0x0}, // 0xc
 { val:0x34, carry:0x0}, // 0xd
 { val:0x38, carry:0x0}, // 0xe
 { val:0x3c, carry:0x0}, // 0xf
 { val:0x40, carry:0x0}, // 0x10
 { val:0x44, carry:0x0}, // 0x11
 { val:0x48, carry:0x0}, // 0x12
 { val:0x4c, carry:0x0}, // 0x13
 { val:0x50, carry:0x0}, // 0x14
 { val:0x54, carry:0x0}, // 0x15
 { val:0x58, carry:0x0}, // 0x16
 { val:0x5c, carry:0x0}, // 0x17
 { val:0x60, carry:0x0}, // 0x18
 { val:0x64, carry:0x0}, // 0x19
 { val:0x68, carry:0x0}, // 0x1a
 { val:0x6c, carry:0x0}, // 0x1b
 { val:0x70, carry:0x0}, // 0x1c
 { val:0x74, carry:0x0}, // 0x1d
 { val:0x78, carry:0x0}, // 0x1e
 { val:0x7c, carry:0x0}, // 0x1f
 { val:0x0, carry:0x1}, // 0x20
 { val:0x4, carry:0x1}, // 0x21
 { val:0x8, carry:0x1}, // 0x22
 { val:0xc, carry:0x1}, // 0x23
 { val:0x10, carry:0x1}, // 0x24
 { val:0x14, carry:0x1}, // 0x25
 { val:0x18, carry:0x1}, // 0x26
 { val:0x1c, carry:0x1}, // 0x27
 { val:0x20, carry:0x1}, // 0x28
 { val:0x24, carry:0x1}, // 0x29
 { val:0x28, carry:0x1}, // 0x2a
 { val:0x2c, carry:0x1}, // 0x2b
 { val:0x30, carry:0x1}, // 0x2c
 { val:0x34, carry:0x1}, // 0x2d
 { val:0x38, carry:0x1}, // 0x2e
 { val:0x3c, carry:0x1}, // 0x2f
 { val:0x40, carry:0x1}, // 0x30
 { val:0x44, carry:0x1}, // 0x31
 { val:0x48, carry:0x1}, // 0x32
 { val:0x4c, carry:0x1}, // 0x33
 { val:0x50, carry:0x1}, // 0x34
 { val:0x54, carry:0x1}, // 0x35
 { val:0x58, carry:0x1}, // 0x36
 { val:0x5c, carry:0x1}, // 0x37
 { val:0x60, carry:0x1}, // 0x38
 { val:0x64, carry:0x1}, // 0x39
 { val:0x68, carry:0x1}, // 0x3a
 { val:0x6c, carry:0x1}, // 0x3b
 { val:0x70, carry:0x1}, // 0x3c
 { val:0x74, carry:0x1}, // 0x3d
 { val:0x78, carry:0x1}, // 0x3e
 { val:0x7c, carry:0x1}, // 0x3f
 { val:0x0, carry:0x2}, // 0x40
 { val:0x4, carry:0x2}, // 0x41
 { val:0x8, carry:0x2}, // 0x42
 { val:0xc, carry:0x2}, // 0x43
 { val:0x10, carry:0x2}, // 0x44
 { val:0x14, carry:0x2}, // 0x45
 { val:0x18, carry:0x2}, // 0x46
 { val:0x1c, carry:0x2}, // 0x47
 { val:0x20, carry:0x2}, // 0x48
 { val:0x24, carry:0x2}, // 0x49
 { val:0x28, carry:0x2}, // 0x4a
 { val:0x2c, carry:0x2}, // 0x4b
 { val:0x30, carry:0x2}, // 0x4c
 { val:0x34, carry:0x2}, // 0x4d
 { val:0x38, carry:0x2}, // 0x4e
 { val:0x3c, carry:0x2}, // 0x4f
 { val:0x40, carry:0x2}, // 0x50
 { val:0x44, carry:0x2}, // 0x51
 { val:0x48, carry:0x2}, // 0x52
 { val:0x4c, carry:0x2}, // 0x53
 { val:0x50, carry:0x2}, // 0x54
 { val:0x54, carry:0x2}, // 0x55
 { val:0x58, carry:0x2}, // 0x56
 { val:0x5c, carry:0x2}, // 0x57
 { val:0x60, carry:0x2}, // 0x58
 { val:0x64, carry:0x2}, // 0x59
 { val:0x68, carry:0x2}, // 0x5a
 { val:0x6c, carry:0x2}, // 0x5b
 { val:0x70, carry:0x2}, // 0x5c
 { val:0x74, carry:0x2}, // 0x5d
 { val:0x78, carry:0x2}, // 0x5e
 { val:0x7c, carry:0x2}, // 0x5f
 { val:0x0, carry:0x3}, // 0x60
 { val:0x4, carry:0x3}, // 0x61
 { val:0x8, carry:0x3}, // 0x62
 { val:0xc, carry:0x3}, // 0x63
 { val:0x10, carry:0x3}, // 0x64
 { val:0x14, carry:0x3}, // 0x65
 { val:0x18, carry:0x3}, // 0x66
 { val:0x1c, carry:0x3}, // 0x67
 { val:0x20, carry:0x3}, // 0x68
 { val:0x24, carry:0x3}, // 0x69
 { val:0x28, carry:0x3}, // 0x6a
 { val:0x2c, carry:0x3}, // 0x6b
 { val:0x30, carry:0x3}, // 0x6c
 { val:0x34, carry:0x3}, // 0x6d
 { val:0x38, carry:0x3}, // 0x6e
 { val:0x3c, carry:0x3}, // 0x6f
 { val:0x40, carry:0x3}, // 0x70
 { val:0x44, carry:0x3}, // 0x71
 { val:0x48, carry:0x3}, // 0x72
 { val:0x4c, carry:0x3}, // 0x73
 { val:0x50, carry:0x3}, // 0x74
 { val:0x54, carry:0x3}, // 0x75
 { val:0x58, carry:0x3}, // 0x76
 { val:0x5c, carry:0x3}, // 0x77
 { val:0x60, carry:0x3}, // 0x78
 { val:0x64, carry:0x3}, // 0x79
 { val:0x68, carry:0x3}, // 0x7a
 { val:0x6c, carry:0x3}, // 0x7b
 { val:0x70, carry:0x3}, // 0x7c
 { val:0x74, carry:0x3}, // 0x7d
 { val:0x78, carry:0x3}, // 0x7e
 { val:0x7c, carry:0x3}, // 0x7f
 { val:0x80, carry:0x0}, // 0x80
 { val:0x84, carry:0x0}, // 0x81
 { val:0x88, carry:0x0}, // 0x82
 { val:0x8c, carry:0x0}, // 0x83
 { val:0x90, carry:0x0}, // 0x84
 { val:0x94, carry:0x0}, // 0x85
 { val:0x98, carry:0x0}, // 0x86
 { val:0x9c, carry:0x0}, // 0x87
 { val:0xa0, carry:0x0}, // 0x88
 { val:0xa4, carry:0x0}, // 0x89
 { val:0xa8, carry:0x0}, // 0x8a
 { val:0xac, carry:0x0}, // 0x8b
 { val:0xb0, carry:0x0}, // 0x8c
 { val:0xb4, carry:0x0}, // 0x8d
 { val:0xb8, carry:0x0}, // 0x8e
 { val:0xbc, carry:0x0}, // 0x8f
 { val:0xc0, carry:0x0}, // 0x90
 { val:0xc4, carry:0x0}, // 0x91
 { val:0xc8, carry:0x0}, // 0x92
 { val:0xcc, carry:0x0}, // 0x93
 { val:0xd0, carry:0x0}, // 0x94
 { val:0xd4, carry:0x0}, // 0x95
 { val:0xd8, carry:0x0}, // 0x96
 { val:0xdc, carry:0x0}, // 0x97
 { val:0xe0, carry:0x0}, // 0x98
 { val:0xe4, carry:0x0}, // 0x99
 { val:0xe8, carry:0x0}, // 0x9a
 { val:0xec, carry:0x0}, // 0x9b
 { val:0xf0, carry:0x0}, // 0x9c
 { val:0xf4, carry:0x0}, // 0x9d
 { val:0xf8, carry:0x0}, // 0x9e
 { val:0xfc, carry:0x0}, // 0x9f
 { val:0x80, carry:0x1}, // 0xa0
 { val:0x84, carry:0x1}, // 0xa1
 { val:0x88, carry:0x1}, // 0xa2
 { val:0x8c, carry:0x1}, // 0xa3
 { val:0x90, carry:0x1}, // 0xa4
 { val:0x94, carry:0x1}, // 0xa5
 { val:0x98, carry:0x1}, // 0xa6
 { val:0x9c, carry:0x1}, // 0xa7
 { val:0xa0, carry:0x1}, // 0xa8
 { val:0xa4, carry:0x1}, // 0xa9
 { val:0xa8, carry:0x1}, // 0xaa
 { val:0xac, carry:0x1}, // 0xab
 { val:0xb0, carry:0x1}, // 0xac
 { val:0xb4, carry:0x1}, // 0xad
 { val:0xb8, carry:0x1}, // 0xae
 { val:0xbc, carry:0x1}, // 0xaf
 { val:0xc0, carry:0x1}, // 0xb0
 { val:0xc4, carry:0x1}, // 0xb1
 { val:0xc8, carry:0x1}, // 0xb2
 { val:0xcc, carry:0x1}, // 0xb3
 { val:0xd0, carry:0x1}, // 0xb4
 { val:0xd4, carry:0x1}, // 0xb5
 { val:0xd8, carry:0x1}, // 0xb6
 { val:0xdc, carry:0x1}, // 0xb7
 { val:0xe0, carry:0x1}, // 0xb8
 { val:0xe4, carry:0x1}, // 0xb9
 { val:0xe8, carry:0x1}, // 0xba
 { val:0xec, carry:0x1}, // 0xbb
 { val:0xf0, carry:0x1}, // 0xbc
 { val:0xf4, carry:0x1}, // 0xbd
 { val:0xf8, carry:0x1}, // 0xbe
 { val:0xfc, carry:0x1}, // 0xbf
 { val:0x80, carry:0x2}, // 0xc0
 { val:0x84, carry:0x2}, // 0xc1
 { val:0x88, carry:0x2}, // 0xc2
 { val:0x8c, carry:0x2}, // 0xc3
 { val:0x90, carry:0x2}, // 0xc4
 { val:0x94, carry:0x2}, // 0xc5
 { val:0x98, carry:0x2}, // 0xc6
 { val:0x9c, carry:0x2}, // 0xc7
 { val:0xa0, carry:0x2}, // 0xc8
 { val:0xa4, carry:0x2}, // 0xc9
 { val:0xa8, carry:0x2}, // 0xca
 { val:0xac, carry:0x2}, // 0xcb
 { val:0xb0, carry:0x2}, // 0xcc
 { val:0xb4, carry:0x2}, // 0xcd
 { val:0xb8, carry:0x2}, // 0xce
 { val:0xbc, carry:0x2}, // 0xcf
 { val:0xc0, carry:0x2}, // 0xd0
 { val:0xc4, carry:0x2}, // 0xd1
 { val:0xc8, carry:0x2}, // 0xd2
 { val:0xcc, carry:0x2}, // 0xd3
 { val:0xd0, carry:0x2}, // 0xd4
 { val:0xd4, carry:0x2}, // 0xd5
 { val:0xd8, carry:0x2}, // 0xd6
 { val:0xdc, carry:0x2}, // 0xd7
 { val:0xe0, carry:0x2}, // 0xd8
 { val:0xe4, carry:0x2}, // 0xd9
 { val:0xe8, carry:0x2}, // 0xda
 { val:0xec, carry:0x2}, // 0xdb
 { val:0xf0, carry:0x2}, // 0xdc
 { val:0xf4, carry:0x2}, // 0xdd
 { val:0xf8, carry:0x2}, // 0xde
 { val:0xfc, carry:0x2}, // 0xdf
 { val:0x80, carry:0x3}, // 0xe0
 { val:0x84, carry:0x3}, // 0xe1
 { val:0x88, carry:0x3}, // 0xe2
 { val:0x8c, carry:0x3}, // 0xe3
 { val:0x90, carry:0x3}, // 0xe4
 { val:0x94, carry:0x3}, // 0xe5
 { val:0x98, carry:0x3}, // 0xe6
 { val:0x9c, carry:0x3}, // 0xe7
 { val:0xa0, carry:0x3}, // 0xe8
 { val:0xa4, carry:0x3}, // 0xe9
 { val:0xa8, carry:0x3}, // 0xea
 { val:0xac, carry:0x3}, // 0xeb
 { val:0xb0, carry:0x3}, // 0xec
 { val:0xb4, carry:0x3}, // 0xed
 { val:0xb8, carry:0x3}, // 0xee
 { val:0xbc, carry:0x3}, // 0xef
 { val:0xc0, carry:0x3}, // 0xf0
 { val:0xc4, carry:0x3}, // 0xf1
 { val:0xc8, carry:0x3}, // 0xf2
 { val:0xcc, carry:0x3}, // 0xf3
 { val:0xd0, carry:0x3}, // 0xf4
 { val:0xd4, carry:0x3}, // 0xf5
 { val:0xd8, carry:0x3}, // 0xf6
 { val:0xdc, carry:0x3}, // 0xf7
 { val:0xe0, carry:0x3}, // 0xf8
 { val:0xe4, carry:0x3}, // 0xf9
 { val:0xe8, carry:0x3}, // 0xfa
 { val:0xec, carry:0x3}, // 0xfb
 { val:0xf0, carry:0x3}, // 0xfc
 { val:0xf4, carry:0x3}, // 0xfd
 { val:0xf8, carry:0x3}, // 0xfe
 { val:0xfc, carry:0x3}, // 0xff
];

const shr4: readonly shiftent[] = [
 { val:0x0, carry:0x0}, // 0x0
 { val:0x10, carry:0x0}, // 0x1
 { val:0x20, carry:0x0}, // 0x2
 { val:0x30, carry:0x0}, // 0x3
 { val:0x40, carry:0x0}, // 0x4
 { val:0x50, carry:0x0}, // 0x5
 { val:0x60, carry:0x0}, // 0x6
 { val:0x70, carry:0x0}, // 0x7
 { val:0x0, carry:0x1}, // 0x8
 { val:0x10, carry:0x1}, // 0x9
 { val:0x20, carry:0x1}, // 0xa
 { val:0x30, carry:0x1}, // 0xb
 { val:0x40, carry:0x1}, // 0xc
 { val:0x50, carry:0x1}, // 0xd
 { val:0x60, carry:0x1}, // 0xe
 { val:0x70, carry:0x1}, // 0xf
 { val:0x0, carry:0x2}, // 0x10
 { val:0x10, carry:0x2}, // 0x11
 { val:0x20, carry:0x2}, // 0x12
 { val:0x30, carry:0x2}, // 0x13
 { val:0x40, carry:0x2}, // 0x14
 { val:0x50, carry:0x2}, // 0x15
 { val:0x60, carry:0x2}, // 0x16
 { val:0x70, carry:0x2}, // 0x17
 { val:0x0, carry:0x3}, // 0x18
 { val:0x10, carry:0x3}, // 0x19
 { val:0x20, carry:0x3}, // 0x1a
 { val:0x30, carry:0x3}, // 0x1b
 { val:0x40, carry:0x3}, // 0x1c
 { val:0x50, carry:0x3}, // 0x1d
 { val:0x60, carry:0x3}, // 0x1e
 { val:0x70, carry:0x3}, // 0x1f
 { val:0x0, carry:0x4}, // 0x20
 { val:0x10, carry:0x4}, // 0x21
 { val:0x20, carry:0x4}, // 0x22
 { val:0x30, carry:0x4}, // 0x23
 { val:0x40, carry:0x4}, // 0x24
 { val:0x50, carry:0x4}, // 0x25
 { val:0x60, carry:0x4}, // 0x26
 { val:0x70, carry:0x4}, // 0x27
 { val:0x0, carry:0x5}, // 0x28
 { val:0x10, carry:0x5}, // 0x29
 { val:0x20, carry:0x5}, // 0x2a
 { val:0x30, carry:0x5}, // 0x2b
 { val:0x40, carry:0x5}, // 0x2c
 { val:0x50, carry:0x5}, // 0x2d
 { val:0x60, carry:0x5}, // 0x2e
 { val:0x70, carry:0x5}, // 0x2f
 { val:0x0, carry:0x6}, // 0x30
 { val:0x10, carry:0x6}, // 0x31
 { val:0x20, carry:0x6}, // 0x32
 { val:0x30, carry:0x6}, // 0x33
 { val:0x40, carry:0x6}, // 0x34
 { val:0x50, carry:0x6}, // 0x35
 { val:0x60, carry:0x6}, // 0x36
 { val:0x70, carry:0x6}, // 0x37
 { val:0x0, carry:0x7}, // 0x38
 { val:0x10, carry:0x7}, // 0x39
 { val:0x20, carry:0x7}, // 0x3a
 { val:0x30, carry:0x7}, // 0x3b
 { val:0x40, carry:0x7}, // 0x3c
 { val:0x50, carry:0x7}, // 0x3d
 { val:0x60, carry:0x7}, // 0x3e
 { val:0x70, carry:0x7}, // 0x3f
 { val:0x0, carry:0x8}, // 0x40
 { val:0x10, carry:0x8}, // 0x41
 { val:0x20, carry:0x8}, // 0x42
 { val:0x30, carry:0x8}, // 0x43
 { val:0x40, carry:0x8}, // 0x44
 { val:0x50, carry:0x8}, // 0x45
 { val:0x60, carry:0x8}, // 0x46
 { val:0x70, carry:0x8}, // 0x47
 { val:0x0, carry:0x9}, // 0x48
 { val:0x10, carry:0x9}, // 0x49
 { val:0x20, carry:0x9}, // 0x4a
 { val:0x30, carry:0x9}, // 0x4b
 { val:0x40, carry:0x9}, // 0x4c
 { val:0x50, carry:0x9}, // 0x4d
 { val:0x60, carry:0x9}, // 0x4e
 { val:0x70, carry:0x9}, // 0x4f
 { val:0x0, carry:0xa}, // 0x50
 { val:0x10, carry:0xa}, // 0x51
 { val:0x20, carry:0xa}, // 0x52
 { val:0x30, carry:0xa}, // 0x53
 { val:0x40, carry:0xa}, // 0x54
 { val:0x50, carry:0xa}, // 0x55
 { val:0x60, carry:0xa}, // 0x56
 { val:0x70, carry:0xa}, // 0x57
 { val:0x0, carry:0xb}, // 0x58
 { val:0x10, carry:0xb}, // 0x59
 { val:0x20, carry:0xb}, // 0x5a
 { val:0x30, carry:0xb}, // 0x5b
 { val:0x40, carry:0xb}, // 0x5c
 { val:0x50, carry:0xb}, // 0x5d
 { val:0x60, carry:0xb}, // 0x5e
 { val:0x70, carry:0xb}, // 0x5f
 { val:0x0, carry:0xc}, // 0x60
 { val:0x10, carry:0xc}, // 0x61
 { val:0x20, carry:0xc}, // 0x62
 { val:0x30, carry:0xc}, // 0x63
 { val:0x40, carry:0xc}, // 0x64
 { val:0x50, carry:0xc}, // 0x65
 { val:0x60, carry:0xc}, // 0x66
 { val:0x70, carry:0xc}, // 0x67
 { val:0x0, carry:0xd}, // 0x68
 { val:0x10, carry:0xd}, // 0x69
 { val:0x20, carry:0xd}, // 0x6a
 { val:0x30, carry:0xd}, // 0x6b
 { val:0x40, carry:0xd}, // 0x6c
 { val:0x50, carry:0xd}, // 0x6d
 { val:0x60, carry:0xd}, // 0x6e
 { val:0x70, carry:0xd}, // 0x6f
 { val:0x0, carry:0xe}, // 0x70
 { val:0x10, carry:0xe}, // 0x71
 { val:0x20, carry:0xe}, // 0x72
 { val:0x30, carry:0xe}, // 0x73
 { val:0x40, carry:0xe}, // 0x74
 { val:0x50, carry:0xe}, // 0x75
 { val:0x60, carry:0xe}, // 0x76
 { val:0x70, carry:0xe}, // 0x77
 { val:0x0, carry:0xf}, // 0x78
 { val:0x10, carry:0xf}, // 0x79
 { val:0x20, carry:0xf}, // 0x7a
 { val:0x30, carry:0xf}, // 0x7b
 { val:0x40, carry:0xf}, // 0x7c
 { val:0x50, carry:0xf}, // 0x7d
 { val:0x60, carry:0xf}, // 0x7e
 { val:0x70, carry:0xf}, // 0x7f
 { val:0x80, carry:0x0}, // 0x80
 { val:0x90, carry:0x0}, // 0x81
 { val:0xa0, carry:0x0}, // 0x82
 { val:0xb0, carry:0x0}, // 0x83
 { val:0xc0, carry:0x0}, // 0x84
 { val:0xd0, carry:0x0}, // 0x85
 { val:0xe0, carry:0x0}, // 0x86
 { val:0xf0, carry:0x0}, // 0x87
 { val:0x80, carry:0x1}, // 0x88
 { val:0x90, carry:0x1}, // 0x89
 { val:0xa0, carry:0x1}, // 0x8a
 { val:0xb0, carry:0x1}, // 0x8b
 { val:0xc0, carry:0x1}, // 0x8c
 { val:0xd0, carry:0x1}, // 0x8d
 { val:0xe0, carry:0x1}, // 0x8e
 { val:0xf0, carry:0x1}, // 0x8f
 { val:0x80, carry:0x2}, // 0x90
 { val:0x90, carry:0x2}, // 0x91
 { val:0xa0, carry:0x2}, // 0x92
 { val:0xb0, carry:0x2}, // 0x93
 { val:0xc0, carry:0x2}, // 0x94
 { val:0xd0, carry:0x2}, // 0x95
 { val:0xe0, carry:0x2}, // 0x96
 { val:0xf0, carry:0x2}, // 0x97
 { val:0x80, carry:0x3}, // 0x98
 { val:0x90, carry:0x3}, // 0x99
 { val:0xa0, carry:0x3}, // 0x9a
 { val:0xb0, carry:0x3}, // 0x9b
 { val:0xc0, carry:0x3}, // 0x9c
 { val:0xd0, carry:0x3}, // 0x9d
 { val:0xe0, carry:0x3}, // 0x9e
 { val:0xf0, carry:0x3}, // 0x9f
 { val:0x80, carry:0x4}, // 0xa0
 { val:0x90, carry:0x4}, // 0xa1
 { val:0xa0, carry:0x4}, // 0xa2
 { val:0xb0, carry:0x4}, // 0xa3
 { val:0xc0, carry:0x4}, // 0xa4
 { val:0xd0, carry:0x4}, // 0xa5
 { val:0xe0, carry:0x4}, // 0xa6
 { val:0xf0, carry:0x4}, // 0xa7
 { val:0x80, carry:0x5}, // 0xa8
 { val:0x90, carry:0x5}, // 0xa9
 { val:0xa0, carry:0x5}, // 0xaa
 { val:0xb0, carry:0x5}, // 0xab
 { val:0xc0, carry:0x5}, // 0xac
 { val:0xd0, carry:0x5}, // 0xad
 { val:0xe0, carry:0x5}, // 0xae
 { val:0xf0, carry:0x5}, // 0xaf
 { val:0x80, carry:0x6}, // 0xb0
 { val:0x90, carry:0x6}, // 0xb1
 { val:0xa0, carry:0x6}, // 0xb2
 { val:0xb0, carry:0x6}, // 0xb3
 { val:0xc0, carry:0x6}, // 0xb4
 { val:0xd0, carry:0x6}, // 0xb5
 { val:0xe0, carry:0x6}, // 0xb6
 { val:0xf0, carry:0x6}, // 0xb7
 { val:0x80, carry:0x7}, // 0xb8
 { val:0x90, carry:0x7}, // 0xb9
 { val:0xa0, carry:0x7}, // 0xba
 { val:0xb0, carry:0x7}, // 0xbb
 { val:0xc0, carry:0x7}, // 0xbc
 { val:0xd0, carry:0x7}, // 0xbd
 { val:0xe0, carry:0x7}, // 0xbe
 { val:0xf0, carry:0x7}, // 0xbf
 { val:0x80, carry:0x8}, // 0xc0
 { val:0x90, carry:0x8}, // 0xc1
 { val:0xa0, carry:0x8}, // 0xc2
 { val:0xb0, carry:0x8}, // 0xc3
 { val:0xc0, carry:0x8}, // 0xc4
 { val:0xd0, carry:0x8}, // 0xc5
 { val:0xe0, carry:0x8}, // 0xc6
 { val:0xf0, carry:0x8}, // 0xc7
 { val:0x80, carry:0x9}, // 0xc8
 { val:0x90, carry:0x9}, // 0xc9
 { val:0xa0, carry:0x9}, // 0xca
 { val:0xb0, carry:0x9}, // 0xcb
 { val:0xc0, carry:0x9}, // 0xcc
 { val:0xd0, carry:0x9}, // 0xcd
 { val:0xe0, carry:0x9}, // 0xce
 { val:0xf0, carry:0x9}, // 0xcf
 { val:0x80, carry:0xa}, // 0xd0
 { val:0x90, carry:0xa}, // 0xd1
 { val:0xa0, carry:0xa}, // 0xd2
 { val:0xb0, carry:0xa}, // 0xd3
 { val:0xc0, carry:0xa}, // 0xd4
 { val:0xd0, carry:0xa}, // 0xd5
 { val:0xe0, carry:0xa}, // 0xd6
 { val:0xf0, carry:0xa}, // 0xd7
 { val:0x80, carry:0xb}, // 0xd8
 { val:0x90, carry:0xb}, // 0xd9
 { val:0xa0, carry:0xb}, // 0xda
 { val:0xb0, carry:0xb}, // 0xdb
 { val:0xc0, carry:0xb}, // 0xdc
 { val:0xd0, carry:0xb}, // 0xdd
 { val:0xe0, carry:0xb}, // 0xde
 { val:0xf0, carry:0xb}, // 0xdf
 { val:0x80, carry:0xc}, // 0xe0
 { val:0x90, carry:0xc}, // 0xe1
 { val:0xa0, carry:0xc}, // 0xe2
 { val:0xb0, carry:0xc}, // 0xe3
 { val:0xc0, carry:0xc}, // 0xe4
 { val:0xd0, carry:0xc}, // 0xe5
 { val:0xe0, carry:0xc}, // 0xe6
 { val:0xf0, carry:0xc}, // 0xe7
 { val:0x80, carry:0xd}, // 0xe8
 { val:0x90, carry:0xd}, // 0xe9
 { val:0xa0, carry:0xd}, // 0xea
 { val:0xb0, carry:0xd}, // 0xeb
 { val:0xc0, carry:0xd}, // 0xec
 { val:0xd0, carry:0xd}, // 0xed
 { val:0xe0, carry:0xd}, // 0xee
 { val:0xf0, carry:0xd}, // 0xef
 { val:0x80, carry:0xe}, // 0xf0
 { val:0x90, carry:0xe}, // 0xf1
 { val:0xa0, carry:0xe}, // 0xf2
 { val:0xb0, carry:0xe}, // 0xf3
 { val:0xc0, carry:0xe}, // 0xf4
 { val:0xd0, carry:0xe}, // 0xf5
 { val:0xe0, carry:0xe}, // 0xf6
 { val:0xf0, carry:0xe}, // 0xf7
 { val:0x80, carry:0xf}, // 0xf8
 { val:0x90, carry:0xf}, // 0xf9
 { val:0xa0, carry:0xf}, // 0xfa
 { val:0xb0, carry:0xf}, // 0xfb
 { val:0xc0, carry:0xf}, // 0xfc
 { val:0xd0, carry:0xf}, // 0xfd
 { val:0xe0, carry:0xf}, // 0xfe
 { val:0xf0, carry:0xf}, // 0xff
];

//shamelessly stolen from UAE

const blitOp = (op:number, srca:number, srcb:number, srcc:number) : number =>
{
  switch(op)
  {
 	case 0x00:  return 0;
 	case 0x01:  return ~(srca | srcb | srcc);
 	case 0x02:  return (srcc & ~(srca | srcb));
 	case 0x03:  return ~(srca | srcb);
 	case 0x04:  return (srcb & ~(srca | srcc));
 	case 0x05:  return ~(srca | srcc);
 	case 0x06:  return (~srca & (srcb ^ srcc));
 	case 0x07:  return ~(srca | (srcb & srcc));
 	case 0x08:  return (~srca & srcb & srcc);
 	case 0x09:  return ~(srca | (srcb ^ srcc));
 	case 0x0a:  return (~srca & srcc);
 	case 0x0b:  return ~(srca | (srcb & ~srcc));
 	case 0x0c:  return (~srca & srcb);
 	case 0x0d:  return ~(srca | (~srcb & srcc));
 	case 0x0e:  return (~srca & (srcb | srcc));
 	case 0x0f:  return ~srca;
 	case 0x10:  return (srca & ~(srcb | srcc));
 	case 0x11:  return ~(srcb | srcc);
 	case 0x12:  return (~srcb & (srca ^ srcc));
 	case 0x13:  return ~(srcb | (srca & srcc));
 	case 0x14:  return (~srcc & (srca ^ srcb));
 	case 0x15:  return ~(srcc | (srca & srcb));
 	case 0x16:  return (srca ^ ((srca & srcb) | (srcb ^ srcc)));
 	case 0x17:  return ~(srca ^ ((srca ^ srcb) & (srca ^ srcc)));
 	case 0x18:  return ((srca ^ srcb) & (srca ^ srcc));
 	case 0x19:  return (srcb ^ (~srcc | (srca & srcb)));
 	case 0x1a:  return (srca ^ (srcc | (srca & srcb)));
 	case 0x1b:  return (srca ^ (srcc | ~(srca ^ srcb)));
 	case 0x1c:  return (srca ^ (srcb | (srca & srcc)));
 	case 0x1d:  return (srca ^ (srcb | ~(srca ^ srcc)));
 	case 0x1e:  return (srca ^ (srcb | srcc));
 	case 0x1f:  return ~(srca & (srcb | srcc));
 	case 0x20:  return (srca & ~srcb & srcc);
 	case 0x21:  return ~(srcb | (srca ^ srcc));
 	case 0x22:  return (~srcb & srcc);
 	case 0x23:  return ~(srcb | (srca & ~srcc));
 	case 0x24:  return ((srca ^ srcb) & (srcb ^ srcc));
 	case 0x25:  return (srca ^ (~srcc | (srca & srcb)));
 	case 0x26:  return (srcb ^ (srcc | (srca & srcb)));
 	case 0x27:  return ~(srca ^ (srcc & (srca ^ srcb)));
 	case 0x28:  return (srcc & (srca ^ srcb));
 	case 0x29:  return ~(srca ^ srcb ^ (srcc | (srca & srcb)));
 	case 0x2a:  return (srcc & ~(srca & srcb));
 	case 0x2b:  return ~(srca ^ ((srca ^ srcb) & (srcb ^ srcc)));
 	case 0x2c:  return (srcb ^ (srca & (srcb | srcc)));
 	case 0x2d:  return (srca ^ (srcb | ~srcc));
 	case 0x2e:  return (srca ^ (srcb | (srca ^ srcc)));
 	case 0x2f:  return ~(srca & (srcb | ~srcc));
 	case 0x30:  return (srca & ~srcb);
 	case 0x31:  return ~(srcb | (~srca & srcc));
 	case 0x32:  return (~srcb & (srca | srcc));
 	case 0x33:  return ~srcb;
 	case 0x34:  return (srcb ^ (srca | (srcb & srcc)));
 	case 0x35:  return (srcb ^ (srca | ~(srcb ^ srcc)));
 	case 0x36:  return (srcb ^ (srca | srcc));
 	case 0x37:  return ~(srcb & (srca | srcc));
 	case 0x38:  return (srca ^ (srcb & (srca | srcc)));
 	case 0x39:  return (srcb ^ (srca | ~srcc));
 	case 0x3a:  return (srcb ^ (srca | (srcb ^ srcc)));
 	case 0x3b:  return ~(srcb & (srca | ~srcc));
 	case 0x3c:  return (srca ^ srcb);
 	case 0x3d:  return (srca ^ (srcb | ~(srca | srcc)));
 	case 0x3e:  return (srca ^ (srcb | (srca ^ (srca | srcc))));
 	case 0x3f:  return ~(srca & srcb);
 	case 0x40:  return (srca & srcb & ~srcc);
 	case 0x41:  return ~(srcc | (srca ^ srcb));
 	case 0x42:  return ((srca ^ srcc) & (srcb ^ srcc));
 	case 0x43:  return (srca ^ (~srcb | (srca & srcc)));
 	case 0x44:  return (srcb & ~srcc);
 	case 0x45:  return ~(srcc | (srca & ~srcb));
 	case 0x46:  return (srcc ^ (srcb | (srca & srcc)));
 	case 0x47:  return ~(srca ^ (srcb & (srca ^ srcc)));
 	case 0x48:  return (srcb & (srca ^ srcc));
 	case 0x49:  return ~(srca ^ srcc ^ (srcb | (srca & srcc)));
 	case 0x4a:  return (srcc ^ (srca & (srcb | srcc)));
 	case 0x4b:  return (srca ^ (~srcb | srcc));
 	case 0x4c:  return (srcb & ~(srca & srcc));
 	case 0x4d:  return (srca ^ ((srca ^ srcb) | ~(srca ^ srcc)));
 	case 0x4e:  return (srca ^ (srcc | (srca ^ srcb)));
 	case 0x4f:  return ~(srca & (~srcb | srcc));
 	case 0x50:  return (srca & ~srcc);
 	case 0x51:  return ~(srcc | (~srca & srcb));
 	case 0x52:  return (srcc ^ (srca | (srcb & srcc)));
 	case 0x53:  return ~(srcb ^ (srca & (srcb ^ srcc)));
 	case 0x54:  return (~srcc & (srca | srcb));
 	case 0x55:  return ~srcc;
 	case 0x56:  return (srcc ^ (srca | srcb));
 	case 0x57:  return ~(srcc & (srca | srcb));
 	case 0x58:  return (srca ^ (srcc & (srca | srcb)));
 	case 0x59:  return (srcc ^ (srca | ~srcb));
 	case 0x5a:  return (srca ^ srcc);
 	case 0x5b:  return (srca ^ (srcc | ~(srca | srcb)));
 	case 0x5c:  return (srcc ^ (srca | (srcb ^ srcc)));
 	case 0x5d:  return ~(srcc & (srca | ~srcb));
 	case 0x5e:  return (srca ^ (srcc | (srca ^ (srca | srcb))));
 	case 0x5f:  return ~(srca & srcc);
 	case 0x60:  return (srca & (srcb ^ srcc));
 	case 0x61:  return ~(srcb ^ srcc ^ (srca | (srcb & srcc)));
 	case 0x62:  return (srcc ^ (srcb & (srca | srcc)));
 	case 0x63:  return (srcb ^ (~srca | srcc));
 	case 0x64:  return (srcb ^ (srcc & (srca | srcb)));
 	case 0x65:  return (srcc ^ (~srca | srcb));
 	case 0x66:  return (srcb ^ srcc);
 	case 0x67:  return (srcb ^ (srcc | ~(srca | srcb)));
 	case 0x68:  return ((srca & srcb) ^ (srcc & (srca | srcb)));
 	case 0x69:  return ~(srca ^ srcb ^ srcc);
 	case 0x6a:  return (srcc ^ (srca & srcb));
 	case 0x6b:  return ~(srca ^ srcb ^ (srcc & (srca | srcb)));
 	case 0x6c:  return (srcb ^ (srca & srcc));
 	case 0x6d:  return ~(srca ^ srcc ^ (srcb & (srca | srcc)));
 	case 0x6e:  return ((~srca & srcb) | (srcb ^ srcc));
 	case 0x6f:  return (~srca | (srcb ^ srcc));
 	case 0x70:  return (srca & ~(srcb & srcc));
 	case 0x71:  return ~(srca ^ ((srca ^ srcb) | (srca ^ srcc)));
 	case 0x72:  return (srcb ^ (srcc | (srca ^ srcb)));
 	case 0x73:  return ~(srcb & (~srca | srcc));
 	case 0x74:  return (srcc ^ (srcb | (srca ^ srcc)));
 	case 0x75:  return ~(srcc & (~srca | srcb));
 	case 0x76:  return (srcb ^ (srcc | (srca ^ (srca & srcb))));
 	case 0x77:  return ~(srcb & srcc);
 	case 0x78:  return (srca ^ (srcb & srcc));
 	case 0x79:  return ~(srcb ^ srcc ^ (srca & (srcb | srcc)));
 	case 0x7a:  return ((srca & ~srcb) | (srca ^ srcc));
 	case 0x7b:  return (~srcb | (srca ^ srcc));
 	case 0x7c:  return ((srca ^ srcb) | (srca & ~srcc));
 	case 0x7d:  return (~srcc | (srca ^ srcb));
 	case 0x7e:  return ((srca ^ srcb) | (srca ^ srcc));
 	case 0x7f:  return ~(srca & srcb & srcc);
 	case 0x80:  return (srca & srcb & srcc);
 	case 0x81:  return ~((srca ^ srcb) | (srca ^ srcc));
 	case 0x82:  return (srcc & ~(srca ^ srcb));
 	case 0x83:  return (srca ^ (~srcb | (srca & ~srcc)));
 	case 0x84:  return (srcb & ~(srca ^ srcc));
 	case 0x85:  return (srca ^ (~srcc | (srca & ~srcb)));
 	case 0x86:  return (srcb ^ srcc ^ (srca & (srcb | srcc)));
 	case 0x87:  return ~(srca ^ (srcb & srcc));
 	case 0x88:  return (srcb & srcc);
 	case 0x89:  return (srcb ^ (~srcc & (~srca | srcb)));
 	case 0x8a:  return (srcc & (~srca | srcb));
 	case 0x8b:  return (srca ^ (~srcb | (srca ^ srcc)));
 	case 0x8c:  return (srcb & (~srca | srcc));
 	case 0x8d:  return (srca ^ (~srcc | (srca ^ srcb)));
 	case 0x8e:  return (srca ^ ((srca ^ srcb) | (srca ^ srcc)));
 	case 0x8f:  return (~srca | (srcb & srcc));
 	case 0x90:  return (srca & ~(srcb ^ srcc));
 	case 0x91:  return (srcb ^ (~srcc | (~srca & srcb)));
 	case 0x92:  return (srca ^ srcc ^ (srcb & (srca | srcc)));
 	case 0x93:  return ~(srcb ^ (srca & srcc));
 	case 0x94:  return (srca ^ srcb ^ (srcc & (srca | srcb)));
 	case 0x95:  return ~(srcc ^ (srca & srcb));
 	case 0x96:  return (srca ^ srcb ^ srcc);
 	case 0x97:  return (srca ^ srcb ^ (srcc | ~(srca | srcb)));
 	case 0x98:  return (srcb ^ (~srcc & (srca | srcb)));
 	case 0x99:  return ~(srcb ^ srcc);
 	case 0x9a:  return (srcc ^ (srca & ~srcb));
 	case 0x9b:  return ~(srcb ^ (srcc & (srca | srcb)));
 	case 0x9c:  return (srcb ^ (srca & ~srcc));
 	case 0x9d:  return ~(srcc ^ (srcb & (srca | srcc)));
 	case 0x9e:  return (srcb ^ srcc ^ (srca | (srcb & srcc)));
 	case 0x9f:  return ~(srca & (srcb ^ srcc));
 	case 0xa0:  return (srca & srcc);
 	case 0xa1:  return (srca ^ (~srcc & (srca | ~srcb)));
 	case 0xa2:  return (srcc & (srca | ~srcb));
 	case 0xa3:  return (srcb ^ (~srca | (srcb ^ srcc)));
 	case 0xa4:  return (srca ^ (~srcc & (srca | srcb)));
 	case 0xa5:  return ~(srca ^ srcc);
 	case 0xa6:  return (srcc ^ (~srca & srcb));
 	case 0xa7:  return ~(srca ^ (srcc & (srca | srcb)));
 	case 0xa8:  return (srcc & (srca | srcb));
 	case 0xa9:  return ~(srcc ^ (srca | srcb));
 	case 0xaa:  return srcc;
 	case 0xab:  return (srcc | ~(srca | srcb));
 	case 0xac:  return (srcb ^ (srca & (srcb ^ srcc)));
 	case 0xad:  return ~(srcc ^ (srca | (srcb & srcc)));
 	case 0xae:  return (srcc | (~srca & srcb));
 	case 0xaf:  return (~srca | srcc);
 	case 0xb0:  return (srca & (~srcb | srcc));
 	case 0xb1:  return ~(srca ^ (srcc | (srca ^ srcb)));
 	case 0xb2:  return (srca ^ ((srca ^ srcc) & (srcb ^ srcc)));
 	case 0xb3:  return (~srcb | (srca & srcc));
 	case 0xb4:  return (srca ^ (srcb & ~srcc));
 	case 0xb5:  return ~(srcc ^ (srca & (srcb | srcc)));
 	case 0xb6:  return (srca ^ srcc ^ (srcb | (srca & srcc)));
 	case 0xb7:  return ~(srcb & (srca ^ srcc));
 	case 0xb8:  return (srca ^ (srcb & (srca ^ srcc)));
 	case 0xb9:  return ~(srcc ^ (srcb | (srca & srcc)));
 	case 0xba:  return (srcc | (srca & ~srcb));
 	case 0xbb:  return (~srcb | srcc);
 	case 0xbc:  return ((srca ^ srcb) | (srca & srcc));
 	case 0xbd:  return ((srca ^ srcb) | ~(srca ^ srcc));
 	case 0xbe:  return (srcc | (srca ^ srcb));
 	case 0xbf:  return (srcc | ~(srca & srcb));
 	case 0xc0:  return (srca & srcb);
 	case 0xc1:  return (srca ^ (~srcb & (srca | ~srcc)));
 	case 0xc2:  return (srca ^ (~srcb & (srca | srcc)));
 	case 0xc3:  return ~(srca ^ srcb);
 	case 0xc4:  return (srcb & (srca | ~srcc));
 	case 0xc5:  return ~(srcb ^ (srca | (srcb ^ srcc)));
 	case 0xc6:  return (srcb ^ (~srca & srcc));
 	case 0xc7:  return ~(srca ^ (srcb & (srca | srcc)));
 	case 0xc8:  return (srcb & (srca | srcc));
 	case 0xc9:  return ~(srcb ^ (srca | srcc));
 	case 0xca:  return (srcc ^ (srca & (srcb ^ srcc)));
 	case 0xcb:  return ~(srcb ^ (srca | (srcb & srcc)));
 	case 0xcc:  return srcb;
 	case 0xcd:  return (srcb | ~(srca | srcc));
 	case 0xce:  return (srcb | (~srca & srcc));
 	case 0xcf:  return (~srca | srcb);
 	case 0xd0:  return (srca & (srcb | ~srcc));
 	case 0xd1:  return ~(srca ^ (srcb | (srca ^ srcc)));
 	case 0xd2:  return (srca ^ (~srcb & srcc));
 	case 0xd3:  return ~(srcb ^ (srca & (srcb | srcc)));
 	case 0xd4:  return (srca ^ ((srca ^ srcb) & (srcb ^ srcc)));
 	case 0xd5:  return (~srcc | (srca & srcb));
 	case 0xd6:  return (srca ^ srcb ^ (srcc | (srca & srcb)));
 	case 0xd7:  return ~(srcc & (srca ^ srcb));
 	case 0xd8:  return (srca ^ (srcc & (srca ^ srcb)));
 	case 0xd9:  return ~(srcb ^ (srcc | (srca & srcb)));
 	case 0xda:  return ((srca & srcb) | (srca ^ srcc));
 	case 0xdb:  return ~((srca ^ srcb) & (srcb ^ srcc));
 	case 0xdc:  return (srcb | (srca & ~srcc));
 	case 0xdd:  return (srcb | ~srcc);
 	case 0xde:  return (srcb | (srca ^ srcc));
 	case 0xdf:  return (srcb | ~(srca & srcc));
 	case 0xe0:  return (srca & (srcb | srcc));
 	case 0xe1:  return ~(srca ^ (srcb | srcc));
 	case 0xe2:  return (srcc ^ (srcb & (srca ^ srcc)));
 	case 0xe3:  return ~(srca ^ (srcb | (srca & srcc)));
 	case 0xe4:  return (srcb ^ (srcc & (srca ^ srcb)));
 	case 0xe5:  return ~(srca ^ (srcc | (srca & srcb)));
 	case 0xe6:  return ((srca & srcb) | (srcb ^ srcc));
 	case 0xe7:  return ~((srca ^ srcb) & (srca ^ srcc));
 	case 0xe8:  return (srca ^ ((srca ^ srcb) & (srca ^ srcc)));
 	case 0xe9:  return (srca ^ srcb ^ (~srcc | (srca & srcb)));
 	case 0xea:  return (srcc | (srca & srcb));
 	case 0xeb:  return (srcc | ~(srca ^ srcb));
 	case 0xec:  return (srcb | (srca & srcc));
 	case 0xed:  return (srcb | ~(srca ^ srcc));
 	case 0xee:  return (srcb | srcc);
 	case 0xef:  return (~srca | srcb | srcc);
 	case 0xf0:  return srca;
 	case 0xf1:  return (srca | ~(srcb | srcc));
 	case 0xf2:  return (srca | (~srcb & srcc));
 	case 0xf3:  return (srca | ~srcb);
 	case 0xf4:  return (srca | (srcb & ~srcc));
 	case 0xf5:  return (srca | ~srcc);
 	case 0xf6:  return (srca | (srcb ^ srcc));
 	case 0xf7:  return (srca | ~(srcb & srcc));
 	case 0xf8:  return (srca | (srcb & srcc));
 	case 0xf9:  return (srca | ~(srcb ^ srcc));
 	case 0xfa:  return (srca | srcc);
 	case 0xfb:  return (srca | ~srcb | srcc);
 	case 0xfc:  return (srca | srcb);
 	case 0xfd:  return (srca | srcb | ~srcc);
 	case 0xfe:  return (srca | srcb | srcc);
 	case 0xff:  return 0xFF;
 }
}

let blitCon = 0xf0; // D = A
let shiftA = 0x00;
let shiftB = 0x00;
let carryA = 0x00;
let carryB = 0x00;
let startMask = 0xff;
let endMask = 0xff;
let mask = 0xff;

const DMARead = (addr: number) : number => {
  return memGet(addr);
}

const DMAWrite = (addr: number, value: number) => {
  return memSet(addr, value);
}

class DMAChannel
{
  addr: number;   // working dma address pointer
  line: number;   // gfx line number
  offset: number; // gfx offset
  control: number;// control bits
  incr: number;   // the increment between bytes
  shift: number;  // shift value for data
  carry: number;  // the carry from last operation
  modulo: number; // the value to be added to move to next line
  smask: number;  // data start mask
  emask: number;  // data end mask
  data: number;   // the data value filled by DMA or constant 

  constructor() {
    this.addr = 0;
    this.line = 0;
    this.offset = 0;
    this.control = 0;
    this.incr = 0;
    this.shift = 0;
    this.carry = 0;
    this.modulo = 0;
    this.data = 0;
    this.smask = 0xff;
    this.emask = 0xff;
  }

  initLinear(addr:number, modulo:number, shift: number, incr:number): void {
    this.addr = addr;
    this.modulo = modulo;
    this.incr = incr;
    this.line = 0;
    this.offset = 0;
    this.control = 0;
  }

  initGfx(line:number, offset:number, shift: number, incr:number): void {
    this.line = line;
    this.offset = offset;
    this.addr = addr;
    this.modulo = 0xFFFF;
    this.incr = incr;
    this.addr = getgfxaddr(this.line,0);
    this.addr += this.offset;
    this.control = 0;
  }

  post(): void {
    this.addr += this.incr;

    // shift before masking
    shift();

    if (this.control & 1) // rowstart
    {
      this.data &= this.smask;
      this.control &= 2; // remove start bit
    }

    if (this.control & 2) // rowend
    {
      this.data &= this.emask;
      if (this.modulo === 0xFFFF) // gfx
      {
        this.line++;
        this.addr = getgfxaddr(this.line,0);
        this.addr += this.offset;
      }
      else
        this.addr += this.modulo;

      this.control &= 1; // remove end bit
    }

  }

  shift(): void {
    let mr = this.data;
    let sr = 0;

    if(this.shift&4)
    {
      let t4 = shr4[mr];
      mr = t4.val;
      sr |= t4.carry;
    }

    if(this.shift&2)
    {
      let t4 = shr2[mr];
      mr = t4.val;
      sr <<= 2;
      sr |= t4.carry;
    }

    if(this.shift&1)
    {
      let t4 = shr1[mr];
      mr = t4.val;
      sr <<= 1;
      sr |= t4.carry;
    }

    // or the previous carry
    this.data = mr | this.carry;
    this.carry = sr;
  }

  read(): void {
    if (this.addr)
    {
      this.data = DMARead(this.addr);
      this.post();
    }
  }

  write(): void {
    if (this.addr)
    {
      DMAWrite(this.addr, this.data);
      this.post();
    }
  }

  rowStart(): void {
    this.carry = 0;
    this.control |= 0x01;
  }

  rowEnd(): void {
    this.control |= 0x02;
  }
}

const DMAA   = new DMAChannel();
const DMAB   = new DMAChannel();
const DMAC   = new DMAChannel();
const DMAD   = new DMAChannel();
const DMACMD = new DMAChannel();

const DMAReadCycle = (start: boolean, end: boolean) => {
  if (start)
  {
    DMAA.rowStart();
    DMAB.rowStart();
    DMAC.rowStart();
  }
  if (end)
  {
    DMAA.rowEnd();
    DMAB.rowEnd();
    DMAC.rowEnd();
  }

  DMAA.read();
  DMAB.read();
  DMAC.read();
}

const DMAWriteCycle = (start: boolean, end: boolean) => {
  if (start)
  {
    DMAD.rowStart();
  }
  if (end)
  {
    DMAD.rowEnd();
  }

  DMAD.write();
}

const DMACycle = (start: boolean, end: boolean, carry: number) => {
  DMAReadCycle(start, end);

  // only load carry
  if (carry===1)
    return;
  else if(carry===2)
    DMAD.data = blitOp(blitCon, DMAA.carry, DMAB.carry, DMAC.carry);

  DMAWriteCycle(start.end);
}

export const blitMask = (s:number, e:number) =>
{
  startMask = s
  endMask = e
}

export const blitShift = (a:number, b:number) =>
{
  shiftA = a
  shiftB = b
}

export const blitFunc = (f:number) =>
{
  blitCon = f
}

const doShiftA = (inv:number) : number =>
{
  let mr = inv & mask;
  let sr = 0;

  if(shiftA&4)
  {
    let t4 = shr4[mr];
    mr = t4.val;
    sr |= t4.carry;
  }
  if(shiftA&2)
  {
    let t4 = shr2[mr];
    mr = t4.val;
    sr <<= 2;
    sr |= t4.carry;
  }
  if(shiftA&1)
  {
    let t4 = shr1[mr];
    mr = t4.val;
    sr <<= 1;
    sr |= t4.carry;
  }

  // or the previous carry, apply mask
  let out = mr | carryA;
  carryA = sr;

  // reset for subsequent values
  mask = 0xff;
  return out;
}

const doShiftB = (inv:number) : number =>
{
  let mr = inv;
  let sr = 0;

  if(shiftB&4)
  {
    let t4 = shr4[mr];
    mr = t4.val;
    sr |= t4.carry;
  }
  if(shiftB&2)
  {
    let t4 = shr2[mr];
    mr = t4.val;
    sr <<= 2;
    sr |= t4.carry;
  }
  if(shiftB&1)
  {
    let t4 = shr1[mr];
    mr = t4.val;
    sr <<= 1;
    sr |= t4.carry;
  }

  // or the previous carry
  let out = (mr | carryB);
  carryB = sr;

  return out;
}

const blitRowStart = () =>
{
  // clear carries at start of row
  carryA = carryB = 0;

  // set start byte mask
  mask = startMask;
}

const blitRowEnd = () =>
{
  // set end byte mask
  mask = endMask;
}

const blitCycle = (a:number, b:number, c:number, skip:boolean) : number =>
{
  // perform shifts, and OR bits of previous carry
  a = doShiftA(a);
  b = doShiftB(b);

  return skip ? 0x00 : blitOp(blitCon, a, b, c);
}

const getgfxaddr = (line:number, page:number) : number =>
{
    if (page)
      page = 0x4000
    else
      page = 0x2000

    if (line>191)
      return 0

    return page + (0x0028*Math.floor(line/64)) + (0x80*Math.floor(Math.floor(line%64)/8)) + (Math.floor(line%8)*0x400);
}

let bppShift = 0
let cycleCount = 0

const configureSource = (
}

export const blit3 = (srcAddr:number, srcw:number, srcx:number,
                     destx:number, desty:number,
                     width:number, height:number) =>
{
}

export const blit2 = (srcAddr:number, srcw:number, srcx:number,
                     destx:number, desty:number,
                     width:number, height:number) =>
{
  // convert all bpp-based values to bits
  srcx  <<= bppShift;
  srcw  <<= bppShift;
  destx <<= bppShift;
  width <<= bppShift;

  // Note, always Div/Mod by 7.
  // compute dest values
  // modulo for first byte
  let dmod = Math.floor(destx % 7);
  // dest offset
  destx = Math.floor(destx / 7);
  // dest width
  let dw = Math.floor((dmod+width+6)/7); 

  // compute src values
  // modulo for first byte
  let smod = Math.floor(srcx % 7);
  // modulo for last byte
  let swmod = Math.floor((smod+width) % 7);
  // src offset
  srcx = Math.floor(srcx / 7);
  srcAddr += srcx;
  // src width
  let sw = Math.floor((smod+width+6)/7); 
  // src modulo
  srcw = Math.floor(srcw/7);

  // start and end masks
  let sMask = shiftmask[smod].val;
  let eMask = shiftmask[swmod].carry;

  let firstCarry = false;
  let lastCarry  = false;
  let shift = 0;

  let msw = sw;
  // always compute shift right
  if (smod > dmod)
  {
    firstCarry = true;
    shift = (7-smod)+dmod;
    msw--;
  }
  else if(smod < dmod)
  {
    shift = dmod-smod;
  }
  else
  {
    shift = 0;
  }

  if (msw < dw)
  {
    lastCarry = true;
  }

  // init channels
  DMAA.initLinear(srcAddr, srcw, shift, 1);
  DMAC.initGfx(desty, destx, 0, 1);
  DMAD.initGfx(desty, destx, 0, 1);

  while(height)
  {
    let fc = firstCarry;

    for(let i=0;i<sw;i++)
    {
      let rs = false;
      let re = false;

      if (i==0)
      {
        rs = true;
      }
      if (i==sw-1)
      {
        re = true;
      }

      // if fc is set, then we just load the carry
      DMACycle(rs, re, fc);

      fc = false;
    }

    if (lastCarry)
    {
      memSet(dtmp, blitCycle(0x00, 0x00, memGet(dtmp), false));
      cycleCount += 3;
    }

    height--;
  }
}

export const blit = (srcAddr:number, srcw:number, srcx:number,
                     destx:number, desty:number,
                     width:number, height:number) =>
{
  // convert all bpp-based values to bytes
  srcx  <<= bppShift;
  srcw  <<= bppShift;
  destx <<= bppShift;
  width <<= bppShift;

  // Note, always Div/Mod by 7.
  // compute dest values
  // modulo for first byte
  let dmod = Math.floor(destx % 7);
  // dest offset
  destx = Math.floor(destx / 7);
  // dest width
  let dw = Math.floor((dmod+width+6)/7); 

  // compute src values
  // modulo for first byte
  let smod = Math.floor(srcx % 7);
  // modulo for last byte
  let swmod = Math.floor((smod+width) % 7);
  // src offset
  srcx = Math.floor(srcx / 7);
  srcAddr += srcx;
  // src width
  let sw = Math.floor((smod+width+6)/7); 
  // src modulo
  srcw = Math.floor(srcw/7);

  // start and end masks
  startMask = shiftmask[smod].val;
  endMask = shiftmask[swmod].carry;

  let firstCarry = false;
  let lastCarry  = false;

  let msw = sw;
  // always compute shift right
  if (smod > dmod)
  {
    firstCarry = true;
    shiftA = (7-smod)+dmod;
    msw--;
  }
  else if(smod < dmod)
  {
    shiftA = dmod-smod;
  }
  else
  {
    shiftA = 0;
  }

  if (msw < dw)
  {
    lastCarry = true;
  }

  //set them equal for now
  shiftB = shiftA;

  //cinterp.log(0,"dmod: %02x smod: %02x shift: %d\n", dmod, smod, shiftA);
  //cinterp.log(0,"fc: %s lc: %s\n", firstCarry?"true":"false",
  //                                 lastCarry?"true":"false");
  //cinterp.log(0,"dw: %02x sw: %02x\n", dw, sw);

  let vmem = getgfxaddr(desty,0);;
  while( vmem && height > 0 )
  {
    let stmp = srcAddr;
    let dtmp = vmem+destx;
    let fc = firstCarry;

    for(let i=0;i<sw;i++)
    {
      let byte = memGet(stmp);
      cycleCount++;

      if (i==0)
      {
        blitRowStart();
      }
      if (i==sw-1)
      {
        blitRowEnd();
      }

      console.log(i + " " + "stmp: " + stmp.toString(16) + " dtmp: " + dtmp.toString(16))
      
      // if fc is set, then we just load the carry
      let result = blitCycle(byte, 0xff, memGet(dtmp), fc);

      if (fc)
      {
        fc = false;
        cycleCount+=2;
      }
      else
      {
        memSet(dtmp, result);
        dtmp++;
        cycleCount+=3;
      }
      stmp++;
    }

    if (lastCarry)
    {
      memSet(dtmp, blitCycle(0x00, 0x00, memGet(dtmp), false));
      cycleCount += 3;
    }

    srcAddr += srcw;
    height--;
    desty++;
    vmem = getgfxaddr(desty, 0);
  }
}
