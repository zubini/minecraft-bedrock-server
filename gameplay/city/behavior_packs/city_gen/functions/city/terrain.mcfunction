tellraw @a {"rawtext":[{"text":"[city] Terrain – Ebene unter den Füssen, Luft darüber …"}]}
scoreboard objectives add cg_t dummy
scoreboard objectives add cg_c dummy
tickingarea remove cg_t_a
tickingarea remove cg_c_a
kill @e[type=armor_stand,tag=city_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add cg_t_o
tag @e[tag=cg_t_o,c=1] add city_o
effect @e[tag=cg_t_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~79 ~98 ~79 cg_t_a true
scoreboard players set @e[tag=cg_t_o,c=1] cg_t 1
execute as @e[tag=cg_t_o,c=1] at @s run function city/prep_batches/p_00
scoreboard players set @e[tag=cg_t_o,c=1] cg_t 2
tellraw @a {"rawtext":[{"text":"[city] Terrain läuft (62 Schritte) …"}]}
