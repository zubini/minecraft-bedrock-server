tellraw @a {"rawtext":[{"text":"[city] Clear – an die Nordwest-Ecke stellen …"}]}
scoreboard objectives add cg_c dummy
scoreboard objectives add cg_t dummy
tickingarea remove cg_c_a
tickingarea remove cg_t_a
tickingarea remove cg1_a
tickingarea remove cg2_a
tickingarea remove cg3_a
tickingarea remove cg4_a
tickingarea remove cg5_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg_c_o
tag @e[tag=cg_c_o,c=1] add city_o
effect @e[tag=cg_c_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~108 ~79 cg_c_a true
scoreboard players set @e[tag=cg_c_o,c=1] cg_c 1
execute as @e[tag=cg_c_o,c=1] at @s run function city/clear_batches/c_00
scoreboard players set @e[tag=cg_c_o,c=1] cg_c 2
tellraw @a {"rawtext":[{"text":"[city] Clear läuft (65 Schritte) …"}]}
