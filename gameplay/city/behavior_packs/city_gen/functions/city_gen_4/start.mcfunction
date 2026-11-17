tellraw @a {"rawtext":[{"text":"[city_gen_4] Starte (seed=314229) – in der Nähe bleiben …"}]}
scoreboard objectives add cg4_b dummy
scoreboard objectives add cg4_c dummy
tickingarea remove cg4_a
kill @e[type=armor_stand,tag=cg4_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg4_o
effect @e[tag=cg4_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~98 ~79 cg4_a true
scoreboard players set @e[tag=cg4_o,c=1] cg4_c 0
scoreboard players set @e[tag=cg4_o,c=1] cg4_b 1
execute as @e[tag=cg4_o,c=1] at @s run function city_gen_4/terrain_batches/t_00
scoreboard players set @e[tag=cg4_o,c=1] cg4_b 2
tellraw @a {"rawtext":[{"text":"[city_gen_4] Bau läuft (35 Schritte) …"}]}
