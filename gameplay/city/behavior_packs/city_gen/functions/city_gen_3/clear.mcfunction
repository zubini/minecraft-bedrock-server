tellraw @a {"rawtext":[{"text":"[city_gen_3] Clear – Nordwest-Ecke bleiben …"}]}
scoreboard objectives add cg3_b dummy
scoreboard objectives add cg3_c dummy
tickingarea remove cg3_a
kill @e[type=armor_stand,tag=cg3_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg3_o
effect @e[tag=cg3_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~98 ~79 cg3_a true
scoreboard players set @e[tag=cg3_o,c=1] cg3_b 0
scoreboard players set @e[tag=cg3_o,c=1] cg3_c 1
execute as @e[tag=cg3_o,c=1] at @s run function city_gen_3/clear_batches/c_00
scoreboard players set @e[tag=cg3_o,c=1] cg3_c 2
tellraw @a {"rawtext":[{"text":"[city_gen_3] Clear läuft (21 Schritte) …"}]}
