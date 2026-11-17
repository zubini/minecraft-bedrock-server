tellraw @a {"rawtext":[{"text":"[stadium] Starte – Nordwest-Ecke, Fläche 70×100 nach Ost+Süd …"}]}
scoreboard objectives add st_b dummy
scoreboard objectives add st_c dummy
tickingarea remove st_a
tickingarea remove st_ca
kill @e[type=armor_stand,tag=st_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add st_o
tag @e[tag=st_o,c=1] add st_o
effect @e[tag=st_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~69 ~36 ~99 st_a true
scoreboard players set @e[tag=st_o,c=1] st_b 1
execute as @e[tag=st_o,c=1] at @s run function stadium/build_batches/b_00
scoreboard players set @e[tag=st_o,c=1] st_b 2
tellraw @a {"rawtext":[{"text":"[stadium] Bau läuft (1292 Schritte) …"}]}
