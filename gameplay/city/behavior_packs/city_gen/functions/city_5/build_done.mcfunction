scoreboard players set @e[tag=cg5_o] cg5_b 0
tickingarea remove cg5_a
kill @e[tag=cg5_o]
tellraw @a {"rawtext":[{"text":"[city_5] Fertig. Undo: /function city/clear"}]}
