interface TeamMember {
  name: string;
  position: string;
  img: string;
  description: string;
}

$(() => {
  fetch(App.__DEV__ ? "/team.json" : "//cdn.a1motion.com/preview/team.json")
    .then((res) => res.json())
    .then((data) => {
      const { team }: { team: TeamMember[] } = data;
      team.forEach((person) => {
        $("#team-members").append(
          $(`<div class="team-row-item">
  <div class="person-card shadow-md">
    <div class="header">
      <div class="image">
        <span>
          <a href="https://rewarecdn.a1motion.com/dev/${person.img}.png?width=700" data-fancybox data-caption="${person.name}">
            <img src="https://rewarecdn.a1motion.com/dev/${person.img}.png?width=128" alt="${person.name}">
          </a>
        </span>
      </div>
      <div class="details">
        <div class="title">
          ${person.name}
        </div>
        <div class="description">
          ${person.position}
        </div>
      </div>
    </div>
    <p class="body">
      ${person.description}
    </p>
  </div>
</div>`)
        );
      });
    });
});
