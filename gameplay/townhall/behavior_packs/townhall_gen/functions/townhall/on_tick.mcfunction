execute as @e[tag=th_o,c=1] at @s if score @s th_b matches 1 run function townhall/build_batches/b_00
execute as @e[tag=th_o,c=1] at @s if score @s th_b matches 2 run function townhall/build_batches/b_01
execute as @e[tag=th_o,c=1] at @s if score @s th_b matches 3 run function townhall/build_batches/b_02
execute as @e[tag=th_o,c=1] at @s if score @s th_b matches 4 run function townhall/build_batches/b_03
execute as @e[tag=th_o,c=1] if score @s th_b matches 1..4 run scoreboard players add @s th_b 1
execute as @e[tag=th_o,c=1] if score @s th_b matches 5 run function townhall/build_done
execute as @e[tag=th_co,c=1] at @s if score @s th_c matches 1 run function townhall/clear_batches/c_00
execute as @e[tag=th_co,c=1] at @s if score @s th_c matches 2 run function townhall/clear_batches/c_01
execute as @e[tag=th_co,c=1] at @s if score @s th_c matches 3 run function townhall/clear_batches/c_02
execute as @e[tag=th_co,c=1] at @s if score @s th_c matches 4 run function townhall/clear_batches/c_03
execute as @e[tag=th_co,c=1] at @s if score @s th_c matches 5 run function townhall/clear_batches/c_04
execute as @e[tag=th_co,c=1] if score @s th_c matches 1..5 run scoreboard players add @s th_c 1
execute as @e[tag=th_co,c=1] if score @s th_c matches 6 run function townhall/clear_done
