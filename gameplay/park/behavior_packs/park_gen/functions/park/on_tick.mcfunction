execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 1 run function park/build_batches/b_00
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 2 run function park/build_batches/b_01
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 3 run function park/build_batches/b_02
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 4 run function park/build_batches/b_03
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 5 run function park/build_batches/b_04
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 6 run function park/build_batches/b_05
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 7 run function park/build_batches/b_06
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 8 run function park/build_batches/b_07
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 9 run function park/build_batches/b_08
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 10 run function park/build_batches/b_09
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 11 run function park/build_batches/b_10
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 12 run function park/build_batches/b_11
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 13 run function park/build_batches/b_12
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 14 run function park/build_batches/b_13
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 15 run function park/build_batches/b_14
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 16 run function park/build_batches/b_15
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 17 run function park/build_batches/b_16
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 18 run function park/build_batches/b_17
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 19 run function park/build_batches/b_18
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 20 run function park/build_batches/b_19
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 21 run function park/build_batches/b_20
execute as @e[tag=pk_o,c=1] at @s if score @s pk_b matches 22 run function park/build_batches/b_21
execute as @e[tag=pk_o,c=1] if score @s pk_b matches 1..22 run scoreboard players add @s pk_b 1
execute as @e[tag=pk_o,c=1] if score @s pk_b matches 23 run function park/build_done
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 1 run function park/clear_batches/c_00
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 2 run function park/clear_batches/c_01
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 3 run function park/clear_batches/c_02
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 4 run function park/clear_batches/c_03
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 5 run function park/clear_batches/c_04
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 6 run function park/clear_batches/c_05
execute as @e[tag=pk_co,c=1] at @s if score @s pk_c matches 7 run function park/clear_batches/c_06
execute as @e[tag=pk_co,c=1] if score @s pk_c matches 1..7 run scoreboard players add @s pk_c 1
execute as @e[tag=pk_co,c=1] if score @s pk_c matches 8 run function park/clear_done
