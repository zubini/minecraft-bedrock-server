scoreboard players set @e[tag=cg1_o] cg1_b 0
tickingarea remove cg1_a
kill @e[tag=cg1_o]
tellraw @a {"rawtext":[{"text":"[city_1] Fertig. Undo: /function city/clear"}]}
