<script>
	import { _ } from 'svelte-i18n';
	import { supabase } from '$lib/supabase.js';
	import { goto } from '$app/navigation';
	import LanguageToggle from '$lib/components/LanguageToggle.svelte';

	// ── Tab ───────────────────────────────────────────────────
	let tab = 'login'; // 'login' | 'register'

	// ── Login ─────────────────────────────────────────────────
	let email = '';
	let password = '';
	let loading = false;
	let loginError = '';

	async function handleLogin() {
		if (!email || !password) return;
		loading = true;
		loginError = '';
		console.log('[login] intentando con:', email);
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		console.log('[login] resultado:', { data, error });
		loading = false;
		if (error) {
			loginError = 'Error: ' + error.message;
		} else {
			// Full reload para que el servidor detecte la cookie de sesión
			window.location.href = '/dashboard';
		}
	}

	// ── Register ──────────────────────────────────────────────
	let regName = '';
	let regEmail = '';
	let regPassword = '';
	let regPassword2 = '';
	let registering = false;
	let regError = '';
	let regSuccess = false;

	async function handleRegister() {
		regError = '';
		if (!regName || !regEmail || !regPassword) {
			regError = 'Completá todos los campos.';
			return;
		}
		if (regPassword.length < 6) {
			regError = 'La contraseña debe tener al menos 6 caracteres.';
			return;
		}
		if (regPassword !== regPassword2) {
			regError = 'Las contraseñas no coinciden.';
			return;
		}
		registering = true;
		const { error } = await supabase.auth.signUp({
			email: regEmail,
			password: regPassword,
			options: { data: { full_name: regName } }
		});
		registering = false;
		if (error) {
			regError = error.message;
		} else {
			regSuccess = true;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') tab === 'login' ? handleLogin() : handleRegister();
	}

	function switchTab(t) {
		tab = t;
		loginError = '';
		regError = '';
		regSuccess = false;
	}
</script>

<svelte:head>
	<title>Acceso — Inventario Pañol</title>
</svelte:head>

<div class="login-page">
	<div class="bg-grid"></div>
	<div class="bg-glow"></div>

	<div class="login-container">
		<!-- Logo -->
		<div class="login-logo">
			<div class="logo-circle"><i class="ph ph-package"></i></div>
			<h1 class="login-brand">Inventario Pañol</h1>
			<p class="login-sub">Sistema de Gestión Escolar</p>
		</div>

		<!-- Card -->
		<div class="login-card">
			<!-- Tabs -->
			<div class="auth-tabs">
				<button
					id="tab-login"
					class="auth-tab"
					class:active={tab === 'login'}
					on:click={() => switchTab('login')}
				>
					Iniciar sesión
				</button>
				<button
					id="tab-register"
					class="auth-tab"
					class:active={tab === 'register'}
					on:click={() => switchTab('register')}
				>
					Registrarse
				</button>
			</div>

			<!-- Login Form -->
			{#if tab === 'login'}
				{#if loginError}
					<div class="alert alert-danger mb-4">
						<span><i class="ph ph-warning-circle"></i></span><span>{loginError}</span>
					</div>
				{/if}

				<div class="form-group">
					<label class="form-label" for="email">Email</label>
					<input
						id="email"
						type="email"
						class="form-control"
						bind:value={email}
						on:keydown={handleKeydown}
						placeholder="tu@email.com"
						autocomplete="email"
					/>
				</div>

				<div class="form-group mt-4">
					<label class="form-label" for="password">Contraseña</label>
					<input
						id="password"
						type="password"
						class="form-control"
						bind:value={password}
						on:keydown={handleKeydown}
						placeholder="••••••••"
						autocomplete="current-password"
					/>
				</div>

				<button
					id="login-btn"
					class="btn btn-primary w-full mt-6"
					style="justify-content: center; padding: 0.75rem;"
					on:click={handleLogin}
					disabled={loading || !email || !password}
				>
					{#if loading}
						<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
						Ingresando...
					{:else}
						Ingresar
					{/if}
				</button>

				<p class="reg-hint mt-4">
					¿Primera vez? <button class="link-btn" on:click={() => switchTab('register')}>Creá tu cuenta →</button>
				</p>

			<!-- Register Form -->
			{:else}
				{#if regSuccess}
					<div class="success-box">
						<div class="success-icon"><i class="ph ph-check-circle"></i></div>
						<h3>¡Cuenta creada!</h3>
						<p>
							Tu cuenta fue registrada con el rol <strong>Alumno</strong>.<br />
							Un administrador puede cambiar tu rol desde la sección Usuarios.
						</p>
						{#if regEmail}
							<p class="hint-small">Si Supabase requiere verificación, revisá tu email <strong>{regEmail}</strong>.</p>
						{/if}
						<button class="btn btn-primary mt-4" on:click={() => switchTab('login')}>
							← Ir a Iniciar sesión
						</button>
					</div>
				{:else}
					{#if regError}
						<div class="alert alert-danger mb-4">
							<span><i class="ph ph-warning-circle"></i></span><span>{regError}</span>
						</div>
					{/if}

					<div class="form-group">
						<label class="form-label" for="reg-name">Nombre completo *</label>
						<input
							id="reg-name"
							class="form-control"
							bind:value={regName}
							on:keydown={handleKeydown}
							placeholder="Juan García"
							autocomplete="name"
						/>
					</div>

					<div class="form-group mt-4">
						<label class="form-label" for="reg-email">Email *</label>
						<input
							id="reg-email"
							type="email"
							class="form-control"
							bind:value={regEmail}
							on:keydown={handleKeydown}
							placeholder="tu@email.com"
							autocomplete="email"
						/>
					</div>

					<div class="form-group mt-4">
						<label class="form-label" for="reg-pass">Contraseña * <span class="form-hint">(mín. 6 caracteres)</span></label>
						<input
							id="reg-pass"
							type="password"
							class="form-control"
							bind:value={regPassword}
							on:keydown={handleKeydown}
							placeholder="••••••••"
							autocomplete="new-password"
						/>
					</div>

					<div class="form-group mt-4">
						<label class="form-label" for="reg-pass2">Repetir contraseña *</label>
						<input
							id="reg-pass2"
							type="password"
							class="form-control"
							bind:value={regPassword2}
							on:keydown={handleKeydown}
							placeholder="••••••••"
							autocomplete="new-password"
						/>
					</div>

					<div class="alert alert-info mt-4" style="font-size:0.8rem">
						<span><i class="ph ph-info"></i></span>
						<span>Tu cuenta se crea con rol <strong>Alumno</strong>. El administrador puede asignarte un rol desde el panel de Usuarios.</span>
					</div>

					<button
						id="register-btn"
						class="btn btn-secondary w-full mt-4"
						style="justify-content: center; padding: 0.75rem;"
						on:click={handleRegister}
						disabled={registering || !regName || !regEmail || !regPassword}
					>
						{#if registering}
							<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
							Creando cuenta...
						{:else}
							Crear cuenta
						{/if}
					</button>

					<p class="reg-hint mt-4">
						¿Ya tenés cuenta? <button class="link-btn" on:click={() => switchTab('login')}>Iniciá sesión →</button>
					</p>
				{/if}
			{/if}
		</div>

		<div class="login-footer">
			<LanguageToggle />
		</div>
	</div>
</div>

<style>
	.login-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-base);
		position: relative;
		overflow: hidden;
	}

	.bg-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
		background-size: 40px 40px;
		pointer-events: none;
	}

	.bg-glow {
		position: absolute;
		top: -200px;
		left: 50%;
		transform: translateX(-50%);
		width: 600px;
		height: 600px;
		background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
		pointer-events: none;
	}

	.login-container {
		position: relative;
		z-index: 1;
		width: 100%;
		max-width: 440px;
		padding: var(--space-6);
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.login-logo {
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.logo-circle {
		width: 72px;
		height: 72px;
		background: linear-gradient(135deg, var(--primary), var(--primary-dark));
		border-radius: var(--radius-xl);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 2rem;
		box-shadow: 0 8px 32px var(--primary-glow);
		animation: float 3s ease-in-out infinite;
	}

	@keyframes float {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-6px); }
	}

	.login-brand {
		font-size: 1.75rem;
		font-weight: 800;
		color: var(--text-primary);
		letter-spacing: -0.02em;
	}

	.login-sub {
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.login-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		padding: var(--space-6);
		box-shadow: var(--shadow-lg);
	}

	/* Tabs */
	.auth-tabs {
		display: flex;
		gap: 4px;
		background: var(--bg-surface);
		border-radius: var(--radius);
		padding: 4px;
		margin-bottom: var(--space-6);
		border: 1px solid var(--border);
	}

	.auth-tab {
		flex: 1;
		padding: 0.5rem;
		border: none;
		border-radius: calc(var(--radius) - 2px);
		background: transparent;
		color: var(--text-muted);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition);
		font-family: inherit;
	}
	.auth-tab:hover:not(.active) { color: var(--text-secondary); }
	.auth-tab.active {
		background: var(--primary);
		color: white;
		box-shadow: 0 2px 8px var(--primary-glow);
	}

	/* Success box */
	.success-box {
		text-align: center;
		padding: var(--space-4) 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}
	.success-icon { font-size: 3rem; }
	.success-box h3 { color: var(--secondary); font-size: 1.2rem; }
	.success-box p { font-size: 0.875rem; color: var(--text-secondary); max-width: 280px; }
	.hint-small { font-size: 0.78rem; color: var(--text-muted); }

	/* Hint link */
	.reg-hint { font-size: 0.8rem; color: var(--text-muted); text-align: center; }
	.link-btn {
		background: none;
		border: none;
		color: var(--primary-light);
		cursor: pointer;
		font-size: inherit;
		font-family: inherit;
		padding: 0;
		transition: color var(--transition);
	}
	.link-btn:hover { color: var(--primary); }

	.login-footer {
		display: flex;
		justify-content: center;
	}
</style>
