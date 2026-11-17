scoreboard players set @e[tag=ts_co] ts_c 0
tickingarea remove ts_ca
kill @e[tag=ts_co]
tellraw @a {"rawtext":[{"text":"[trainstation] Clear fertig."}]}
