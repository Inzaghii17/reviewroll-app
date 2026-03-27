// Actor Profile Page
async function renderActorDetail(container, params) {
  const personId = params.id;
  let person;
  try {
    person = await api.getPerson(personId);
  } catch (e) {
    container.innerHTML = `<div class="page"><div class="container">
      <div class="empty-state"><div class="empty-state__icon">👤</div>
      <div class="empty-state__text">Person not found</div>
      <a href="#/movies" class="btn btn--primary">BROWSE MOVIES</a></div></div></div>`;
    return;
  }

  const allRoles = [];
  if (person.castFavorites) {
    person.castFavorites.forEach(m => allRoles.push({...m, displayRole: m.role}));
  }
  if (person.crewFavorites) {
    person.crewFavorites.forEach(m => {
      if (!allRoles.find(r => r.Movie_ID === m.Movie_ID && r.displayRole === m.role)) {
         allRoles.push({...m, displayRole: m.role});
      }
    });
  }

  // Sort by year
  allRoles.sort((a,b) => (b.Release_year || 0) - (a.Release_year || 0));

  const filmographyHtml = allRoles.length > 0 
    ? allRoles.map(m => `
      <div class="card card-hover" style="cursor:pointer;" onclick="location.hash='#/movie/${m.Movie_ID}'">
        <div style="aspect-ratio:2/3;background-image:url('${m.Image_URL || ''}');background-size:cover;background-position:center;border-radius:var(--radius) var(--radius) 0 0;background-color:var(--bg-dark);"></div>
        <div style="padding:12px;">
          <h3 style="font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${components.escapeHtml(m.Title)}">${components.escapeHtml(m.Title)}</h3>
          <p style="font-size:12px;color:var(--brand-main);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${components.escapeHtml(m.displayRole)}</p>
          <p style="font-size:11px;color:var(--text-muted);">${m.Release_year || 'Unknown'}</p>
        </div>
      </div>
    `).join('')
    : '<p class="text-muted">No known movies.</p>';

  container.innerHTML = `
    <div class="page" style="padding-top:40px;">
      <div class="container">
        <div style="display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap;">
          
          <div style="flex-shrink:0;width:300px;max-width:100%;">
            <div style="width:100%;aspect-ratio:2/3;border-radius:var(--radius-lg);background-image:url('${person.Profile_Image_URL || ''}');background-size:cover;background-position:center;background-color:var(--surface-elevated);box-shadow:var(--shadow-card);display:flex;align-items:center;justify-content:center;font-size:80px;border:1px solid var(--border-color);">
              ${!person.Profile_Image_URL ? person.Name.charAt(0) : ''}
            </div>
            <h1 style="font-family:var(--font-heading);font-size:28px;margin-top:24px;margin-bottom:8px;">${components.escapeHtml(person.Name)}</h1>
            <p style="color:var(--text-secondary);font-size:14px;">Known for ${allRoles.length} movies</p>
          </div>

          <div style="flex-grow:1;min-width:300px;">
            <h2 style="font-family:var(--font-heading);font-size:20px;margin-bottom:24px;letter-spacing:1px;color:var(--brand-main);">FILMOGRAPHY</h2>
            <div class="grid grid--4">
              ${filmographyHtml}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  `;
}
