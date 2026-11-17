scoreboard players set @e[tag=ch_o] ch_b 0
tickingarea remove ch_a
kill @e[tag=ch_o]
tellraw @a {"rawtext":[{"text":"[church] Fertig. Undo: /function church/clear"}]}
