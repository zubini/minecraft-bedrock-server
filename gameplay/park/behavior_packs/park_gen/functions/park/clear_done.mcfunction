scoreboard players set @e[tag=pk_co] pk_c 0
tickingarea remove pk_ca
kill @e[tag=pk_co]
tellraw @a {"rawtext":[{"text":"[park] Clear fertig."}]}
