scoreboard players set @e[tag=th_o] th_b 0
tickingarea remove th_a
kill @e[tag=th_o]
tellraw @a {"rawtext":[{"text":"[townhall] Fertig. Undo: /function townhall/clear"}]}
