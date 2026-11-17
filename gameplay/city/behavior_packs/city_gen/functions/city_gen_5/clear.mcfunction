tellraw @a {"rawtext":[{"text":"[city_gen_5] Clear – Nordwest-Ecke bleiben …"}]}
scoreboard objectives add cg5_b dummy
scoreboard objectives add cg5_c dummy
tickingarea remove cg5_a
kill @e[type=armor_stand,tag=cg5_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg5_o
effect @e[tag=cg5_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~98 ~79 cg5_a true
scoreboard players set @e[tag=cg5_o,c=1] cg5_b 0
scoreboard players set @e[tag=cg5_o,c=1] cg5_c 1
execute as @e[tag=cg5_o,c=1] at @s run function city_gen_5/clear_batches/c_00
scoreboard players set @e[tag=cg5_o,c=1] cg5_c 2
tellraw @a {"rawtext":[{"text":"[city_gen_5] Clear läuft (21 Schritte) …"}]}
