scoreboard players set @e[tag=pk_o] pk_b 0
tickingarea remove pk_a
kill @e[tag=pk_o]
tellraw @a {"rawtext":[{"text":"[park] Fertig. Undo: /function park/clear"}]}
