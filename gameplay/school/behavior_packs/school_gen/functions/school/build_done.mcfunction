scoreboard players set @e[tag=sc_o] sc_b 0
tickingarea remove sc_a
kill @e[tag=sc_o]
tellraw @a {"rawtext":[{"text":"[school] Fertig. Undo: /function school/clear"}]}
