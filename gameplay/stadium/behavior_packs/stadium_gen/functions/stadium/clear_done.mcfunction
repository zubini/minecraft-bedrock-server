scoreboard players set @e[tag=st_co] st_c 0
tickingarea remove st_ca
kill @e[tag=st_co]
tellraw @a {"rawtext":[{"text":"[stadium] Clear fertig."}]}
