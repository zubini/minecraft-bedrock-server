tellraw @a {"rawtext":[{"text":"[city_gen_2] Clear – Nordwest-Ecke bleiben …"}]}
scoreboard objectives add cg2_b dummy
scoreboard objectives add cg2_c dummy
tickingarea remove cg2_a
kill @e[type=armor_stand,tag=cg2_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg2_o
effect @e[tag=cg2_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~98 ~79 cg2_a true
scoreboard players set @e[tag=cg2_o,c=1] cg2_b 0
scoreboard players set @e[tag=cg2_o,c=1] cg2_c 1
execute as @e[tag=cg2_o,c=1] at @s run function city_gen_2/clear_batches/c_00
scoreboard players set @e[tag=cg2_o,c=1] cg2_c 2
tellraw @a {"rawtext":[{"text":"[city_gen_2] Clear läuft (21 Schritte) …"}]}
