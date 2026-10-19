let cookies

export async function openWorkspace(page) {
  if (!cookies) {
    const email = process.env.LOCALVOICE_EMAIL
    const password = process.env.LOCALVOICE_PASSWORD
    if (!email || !password) throw new Error('Set LOCALVOICE_EMAIL and LOCALVOICE_PASSWORD to an existing local account.')
    const response = await page.request.post('http://127.0.0.1:8000/api/auth/login', {
      headers: { origin: 'http://127.0.0.1:8000' }, data: { email, password },
    })
    if (!response.ok()) throw new Error(`Local account login failed (${response.status()}).`)
    cookies = await page.context().cookies()
  } else await page.context().addCookies(cookies)
  await page.goto('http://127.0.0.1:8000/#/app')
}
