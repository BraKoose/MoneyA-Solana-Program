/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/franco_student_pay.json`.
 */
export type FrancoStudentPay = {
  "address": "BBZjnEN1JFj7caLdBMeXCvBAbntAi3Hd2Z9pxQ78zMJV",
  "metadata": {
    "name": "francoStudentPay",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Franco Student Pay"
  },
  "instructions": [
    {
      "name": "freezeStudent",
      "discriminator": [
        176,
        196,
        23,
        172,
        29,
        223,
        108,
        94
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "treasury"
          ]
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student.owner",
                "account": "studentAccount"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializeTreasury",
      "discriminator": [
        124,
        186,
        211,
        195,
        85,
        165,
        129,
        166
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "treasury"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "feeBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "registerStudent",
      "discriminator": [
        108,
        126,
        219,
        150,
        153,
        225,
        102,
        92
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "country",
          "type": "string"
        }
      ]
    },
    {
      "name": "sendUsdc",
      "discriminator": [
        98,
        238,
        97,
        218,
        163,
        10,
        34,
        222
      ],
      "accounts": [
        {
          "name": "sender",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "senderStudent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "sender"
              }
            ]
          }
        },
        {
          "name": "senderAta",
          "writable": true
        },
        {
          "name": "receiver"
        },
        {
          "name": "receiverStudent",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "receiver"
              }
            ]
          }
        },
        {
          "name": "receiverAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "receiver"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "txRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "referenceHash"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "referenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "reference",
          "type": "string"
        }
      ]
    },
    {
      "name": "settleOfframp",
      "discriminator": [
        52,
        188,
        203,
        146,
        80,
        207,
        41,
        248
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "student"
          ]
        },
        {
          "name": "usdcMint",
          "relations": [
            "treasury"
          ]
        },
        {
          "name": "treasury",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "studentAta",
          "writable": true
        },
        {
          "name": "txRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "referenceHash"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "referenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "kotaniReference",
          "type": "string"
        }
      ]
    },
    {
      "name": "settleOnramp",
      "discriminator": [
        139,
        62,
        97,
        57,
        3,
        87,
        44,
        26
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "treasury"
          ]
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "relations": [
            "treasury"
          ]
        },
        {
          "name": "treasuryTokenAccount",
          "writable": true
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "studentOwner"
              }
            ]
          }
        },
        {
          "name": "studentOwner"
        },
        {
          "name": "studentAta",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "studentOwner"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "txRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "referenceHash"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "referenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "kotaniReference",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateFraudScore",
      "discriminator": [
        86,
        39,
        146,
        0,
        233,
        48,
        19,
        233
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "treasury"
          ]
        },
        {
          "name": "treasury",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  114,
                  101,
                  97,
                  115,
                  117,
                  114,
                  121
                ]
              }
            ]
          }
        },
        {
          "name": "txRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  120
                ]
              },
              {
                "kind": "arg",
                "path": "referenceHash"
              }
            ]
          }
        },
        {
          "name": "student",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  117,
                  100,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "student.owner",
                "account": "studentAccount"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "referenceHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "reference",
          "type": "string"
        },
        {
          "name": "score",
          "type": "u8"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "studentAccount",
      "discriminator": [
        123,
        168,
        55,
        111,
        135,
        93,
        232,
        38
      ]
    },
    {
      "name": "transactionRecord",
      "discriminator": [
        206,
        23,
        5,
        97,
        161,
        157,
        25,
        107
      ]
    },
    {
      "name": "treasuryAccount",
      "discriminator": [
        204,
        140,
        18,
        173,
        90,
        152,
        134,
        123
      ]
    }
  ],
  "events": [
    {
      "name": "fraudFlagged",
      "discriminator": [
        105,
        31,
        74,
        90,
        180,
        70,
        139,
        144
      ]
    },
    {
      "name": "offRampSettled",
      "discriminator": [
        241,
        107,
        107,
        64,
        230,
        2,
        242,
        3
      ]
    },
    {
      "name": "onRampSettled",
      "discriminator": [
        247,
        158,
        51,
        239,
        139,
        68,
        39,
        0
      ]
    },
    {
      "name": "studentFrozen",
      "discriminator": [
        243,
        79,
        113,
        11,
        170,
        27,
        167,
        19
      ]
    },
    {
      "name": "studentRegistered",
      "discriminator": [
        158,
        56,
        218,
        59,
        137,
        24,
        20,
        185
      ]
    },
    {
      "name": "transferExecuted",
      "discriminator": [
        8,
        128,
        224,
        132,
        112,
        216,
        192,
        35
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6001,
      "name": "countryTooLong",
      "msg": "Country must be <= 32 bytes"
    },
    {
      "code": 6002,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6003,
      "name": "invalidReference",
      "msg": "Invalid reference"
    },
    {
      "code": 6004,
      "name": "studentFrozen",
      "msg": "Student is frozen"
    },
    {
      "code": 6005,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6006,
      "name": "invalidFeeBps",
      "msg": "Invalid fee_bps"
    },
    {
      "code": 6007,
      "name": "invalidMint",
      "msg": "Invalid mint"
    },
    {
      "code": 6008,
      "name": "invalidTreasuryTokenAccount",
      "msg": "Invalid treasury token account"
    },
    {
      "code": 6009,
      "name": "invalidStudentOwner",
      "msg": "Invalid student owner"
    },
    {
      "code": 6010,
      "name": "referenceTooLong",
      "msg": "Reference too long"
    },
    {
      "code": 6011,
      "name": "referenceHashMismatch",
      "msg": "Reference hash mismatch"
    }
  ],
  "types": [
    {
      "name": "fraudFlagged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reference",
            "type": "string"
          },
          {
            "name": "score",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "offRampSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reference",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "onRampSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reference",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "studentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "country",
            "type": "string"
          },
          {
            "name": "isFrozen",
            "type": "bool"
          },
          {
            "name": "totalVolume",
            "type": "u64"
          },
          {
            "name": "flagged",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "studentFrozen",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "student",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "studentRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "country",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "transactionRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "kotaniReference",
            "type": "string"
          },
          {
            "name": "fraudScore",
            "type": "u8"
          },
          {
            "name": "isFlagged",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "transferExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "receiver",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "reference",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "treasuryAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "treasuryTokenAccount",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
