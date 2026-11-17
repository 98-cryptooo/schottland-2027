import asyncio, re
from playwright.async_api import async_playwright
BASE="http://localhost:8080/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        iphone = p.devices["iPhone 13"]
        errs=[]
        A = await b.new_context(**iphone); B = await b.new_context(**iphone)
        pa = await A.new_page(); pb = await B.new_page()
        for pg in (pa,pb): pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        # Gerät A: alle Ansichten
        await pa.goto(BASE+"?date=2026-11-17#heute"); await pa.wait_for_timeout(500)
        await pa.screenshot(path="a_heute.png", full_page=True)
        for v in ["route","buchen","listen","geld","infos"]:
            await pa.goto(BASE+"?date=2026-11-17#"+v); await pa.wait_for_timeout(300)
            await pa.screenshot(path=f"a_{v}.png", full_page=True)
        # Sync einrichten
        await pa.goto(BASE+"#infos"); await pa.wait_for_timeout(300)
        await pa.click("details.setup summary")
        await pa.fill("input[name=url]","http://127.0.0.1:8081"); await pa.fill("input[name=key]","anonkey"); await pa.fill("input[name=code]","testcode")
        await pa.click("#syncform button"); await pa.wait_for_timeout(1500)
        print("A Status:", await pa.text_content("#sync"))
        # Gerät A: Haken, Buchung, Ausgabe, Notiz
        await pa.goto(BASE+"#listen"); await pa.wait_for_timeout(300)
        await pa.check("[data-check='todo:passport']")
        await pa.fill("form[data-add=pack] input","Wanderstöcke"); await pa.click("form[data-add=pack] button")
        await pa.goto(BASE+"#buchen"); await pa.wait_for_timeout(300)
        await pa.click("[data-book=eta][data-status=bezahlt]")
        await pa.fill("[data-bf=eta][data-k=ref]","ABC123"); await pa.press("[data-bf=eta][data-k=ref]","Tab")
        await pa.goto(BASE+"#geld"); await pa.wait_for_timeout(300)
        await pa.fill("#expform [name=label]","Abendessen"); await pa.fill("#expform [name=amount]","60"); await pa.click("#expform button")
        await pa.wait_for_timeout(2500)
        # Join-Link holen
        await pa.goto(BASE+"#infos"); await pa.wait_for_timeout(500)
        link = await pa.evaluate("(()=>{const c=JSON.parse(localStorage.getItem('sc27-sync'));return location.origin+location.pathname+'#join='+encodeURIComponent(c.code)+'&u='+encodeURIComponent(c.url)+'&k='+encodeURIComponent(c.key)})()")
        # Gerät B tritt bei
        await pb.goto(link); await pb.wait_for_timeout(2000)
        print("B Status:", await pb.text_content("#sync"), "Hash:", await pb.evaluate("location.hash"))
        await pb.goto(BASE+"#listen"); await pb.wait_for_timeout(1500)
        print("B sieht Pass-Haken:", await pb.is_checked("[data-check='todo:passport']"), "| Wanderstöcke:", "Wanderstöcke" in await pb.content())
        await pb.goto(BASE+"#buchen"); await pb.wait_for_timeout(800)
        print("B sieht ETA-Nummer:", await pb.input_value("[data-bf=eta][data-k=ref]"))
        await pb.goto(BASE+"#geld"); await pb.wait_for_timeout(800)
        print("B Saldo:", await pb.text_content(".big"))
        # B offline: Haken setzen, dann wieder online
        await B.set_offline(True)
        await pb.goto(BASE+"?date=2027-02-20#heute"); await pb.wait_for_timeout(800)
        print("B offline lädt Heute:", await pb.text_content("h1"))
        await pb.screenshot(path="b_offline_tag3.png", full_page=True)
        await pb.goto(BASE+"#listen"); await pb.wait_for_timeout(500)
        await pb.check("[data-check='todo:storno']"); await pb.wait_for_timeout(1500)
        print("B Status offline:", await pb.text_content("#sync"))
        await B.set_offline(False); await pb.evaluate("window.dispatchEvent(new Event('online'))"); await pb.wait_for_timeout(2500)
        print("B Status online:", await pb.text_content("#sync"))
        await pa.goto(BASE+"#listen"); await pa.wait_for_timeout(2000)
        print("A sieht Storno-Haken von B:", await pa.is_checked("[data-check='todo:storno']"))
        # Nach der Reise + Export
        await pa.goto(BASE+"?date=2027-03-01#heute"); await pa.wait_for_timeout(500); print("Nach Reise:", await pa.text_content("h1"))
        await pa.goto(BASE+"#infos"); await pa.wait_for_timeout(500)
        async with pa.expect_download() as d: await pa.click("#ics")
        dl = await d.value; await dl.save_as("t.ics")
        async with pa.expect_download() as d: await pa.click("#csv")
        dl = await d.value; await dl.save_as("t.csv")
        # Desktop-Ansicht
        D = await b.new_context(viewport={"width":1280,"height":900}); pd = await D.new_page()
        await pd.goto(BASE+"#route/d4"); await pd.wait_for_timeout(500); await pd.click("#d4 [data-map=d4]"); await pd.wait_for_timeout(500)
        await pd.screenshot(path="desk_route.png")
        print("Fehler:", errs or "keine")
        await b.close()
asyncio.run(main())
