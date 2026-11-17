tellraw @a {"rawtext":[{"text":"[park] Starte – Nordwest-Ecke, Fläche 48×48 nach Ost+Süd …"}]}
scoreboard objectives add pk_b dummy
scoreboard objectives add pk_c dummy
tickingarea remove pk_a
tickingarea remove pk_ca
kill @e[type=armor_stand,tag=pk_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add pk_o
tag @e[tag=pk_o,c=1] add pk_o
effect @e[tag=pk_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~47 ~20 ~47 pk_a true
scoreboard players set @e[tag=pk_o,c=1] pk_b 1
execute as @e[tag=pk_o,c=1] at @s run function park/build_batches/b_00
scoreboard players set @e[tag=pk_o,c=1] pk_b 2
tellraw @a {"rawtext":[{"text":"[park] Bau läuft (22 Schritte) …"}]}
