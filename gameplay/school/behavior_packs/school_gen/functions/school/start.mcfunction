tellraw @a {"rawtext":[{"text":"[school] Starte – Nordwest-Ecke, Fläche 36×48 nach Ost+Süd …"}]}
scoreboard objectives add sc_b dummy
scoreboard objectives add sc_c dummy
tickingarea remove sc_a
tickingarea remove sc_ca
kill @e[type=armor_stand,tag=sc_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add sc_o
tag @e[tag=sc_o,c=1] add sc_o
effect @e[tag=sc_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~35 ~26 ~47 sc_a true
scoreboard players set @e[tag=sc_o,c=1] sc_b 1
execute as @e[tag=sc_o,c=1] at @s run function school/build_batches/b_00
scoreboard players set @e[tag=sc_o,c=1] sc_b 2
tellraw @a {"rawtext":[{"text":"[school] Bau läuft (5 Schritte) …"}]}
