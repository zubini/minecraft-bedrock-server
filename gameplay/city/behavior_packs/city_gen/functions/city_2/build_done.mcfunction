scoreboard players set @e[tag=cg2_o] cg2_b 0
tickingarea remove cg2_a
kill @e[tag=cg2_o]
tellraw @a {"rawtext":[{"text":"[city_2] Fertig. Undo: /function city/clear"}]}
