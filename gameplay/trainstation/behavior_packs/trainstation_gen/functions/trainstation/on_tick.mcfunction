execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 1 run function trainstation/build_batches/b_00
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 2 run function trainstation/build_batches/b_01
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 3 run function trainstation/build_batches/b_02
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 4 run function trainstation/build_batches/b_03
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 5 run function trainstation/build_batches/b_04
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 6 run function trainstation/build_batches/b_05
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 7 run function trainstation/build_batches/b_06
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 8 run function trainstation/build_batches/b_07
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 9 run function trainstation/build_batches/b_08
execute as @e[tag=ts_o,c=1] at @s if score @s ts_b matches 10 run function trainstation/build_batches/b_09
execute as @e[tag=ts_o,c=1] if score @s ts_b matches 1..10 run scoreboard players add @s ts_b 1
execute as @e[tag=ts_o,c=1] if score @s ts_b matches 11 run function trainstation/build_done
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 1 run function trainstation/clear_batches/c_00
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 2 run function trainstation/clear_batches/c_01
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 3 run function trainstation/clear_batches/c_02
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 4 run function trainstation/clear_batches/c_03
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 5 run function trainstation/clear_batches/c_04
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 6 run function trainstation/clear_batches/c_05
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 7 run function trainstation/clear_batches/c_06
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 8 run function trainstation/clear_batches/c_07
execute as @e[tag=ts_co,c=1] at @s if score @s ts_c matches 9 run function trainstation/clear_batches/c_08
execute as @e[tag=ts_co,c=1] if score @s ts_c matches 1..9 run scoreboard players add @s ts_c 1
execute as @e[tag=ts_co,c=1] if score @s ts_c matches 10 run function trainstation/clear_done
