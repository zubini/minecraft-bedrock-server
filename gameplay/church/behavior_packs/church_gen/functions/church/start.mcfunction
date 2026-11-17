tellraw @a {"rawtext":[{"text":"[church] Starte – Nordwest-Ecke, Fläche 24×40 nach Ost+Süd …"}]}
scoreboard objectives add ch_b dummy
scoreboard objectives add ch_c dummy
tickingarea remove ch_a
tickingarea remove ch_ca
kill @e[type=armor_stand,tag=ch_o]
summon armor_stand ~ ~ ~
tag @e[type=armor_stand,r=3,c=1] add ch_o
tag @e[tag=ch_o,c=1] add ch_o
effect @e[tag=ch_o] invisibility 999999 0 true
tickingarea add ~0 ~-1 ~0 ~23 ~43 ~39 ch_a true
scoreboard players set @e[tag=ch_o,c=1] ch_b 1
execute as @e[tag=ch_o,c=1] at @s run function church/build_batches/b_00
scoreboard players set @e[tag=ch_o,c=1] ch_b 2
tellraw @a {"rawtext":[{"text":"[church] Bau läuft (5 Schritte) …"}]}
