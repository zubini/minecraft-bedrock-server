execute as @e[tag=sc_o,c=1] at @s if score @s sc_b matches 1 run function school/build_batches/b_00
execute as @e[tag=sc_o,c=1] at @s if score @s sc_b matches 2 run function school/build_batches/b_01
execute as @e[tag=sc_o,c=1] at @s if score @s sc_b matches 3 run function school/build_batches/b_02
execute as @e[tag=sc_o,c=1] at @s if score @s sc_b matches 4 run function school/build_batches/b_03
execute as @e[tag=sc_o,c=1] at @s if score @s sc_b matches 5 run function school/build_batches/b_04
execute as @e[tag=sc_o,c=1] if score @s sc_b matches 1..5 run scoreboard players add @s sc_b 1
execute as @e[tag=sc_o,c=1] if score @s sc_b matches 6 run function school/build_done
execute as @e[tag=sc_co,c=1] at @s if score @s sc_c matches 1 run function school/clear_batches/c_00
execute as @e[tag=sc_co,c=1] at @s if score @s sc_c matches 2 run function school/clear_batches/c_01
execute as @e[tag=sc_co,c=1] at @s if score @s sc_c matches 3 run function school/clear_batches/c_02
execute as @e[tag=sc_co,c=1] at @s if score @s sc_c matches 4 run function school/clear_batches/c_03
execute as @e[tag=sc_co,c=1] at @s if score @s sc_c matches 5 run function school/clear_batches/c_04
execute as @e[tag=sc_co,c=1] if score @s sc_c matches 1..5 run scoreboard players add @s sc_c 1
execute as @e[tag=sc_co,c=1] if score @s sc_c matches 6 run function school/clear_done
