scoreboard players set @e[tag=ts_o] ts_b 0
tickingarea remove ts_a
kill @e[tag=ts_o]
tellraw @a {"rawtext":[{"text":"[trainstation] Fertig. Undo: /function trainstation/clear"}]}
