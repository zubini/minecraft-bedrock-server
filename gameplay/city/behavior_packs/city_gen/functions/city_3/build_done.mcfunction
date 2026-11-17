scoreboard players set @e[tag=cg3_o] cg3_b 0
tickingarea remove cg3_a
kill @e[tag=cg3_o]
tellraw @a {"rawtext":[{"text":"[city_3] Fertig. Undo: /function city/clear"}]}
