scoreboard players set @e[tag=st_o] st_b 0
tickingarea remove st_a
kill @e[tag=st_o]
tellraw @a {"rawtext":[{"text":"[stadium] Fertig. Undo: /function stadium/clear"}]}
