using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Notification24.Api.Hubs;
using Notification24.Api.Seeding;
using Notification24.Infrastructure;
using Notification24.Infrastructure.Configuration;
using Notification24.Infrastructure.Identity;
using Notification24.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var firebaseOptions = builder.Configuration.GetSection(FirebaseOptions.SectionName).Get<FirebaseOptions>() ?? new FirebaseOptions();
if (string.IsNullOrWhiteSpace(firebaseOptions.ProjectId))
{
    throw new InvalidOperationException("Firebase:ProjectId is required.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://securetoken.google.com/{firebaseOptions.ProjectId}";
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = $"https://securetoken.google.com/{firebaseOptions.ProjectId}",
            ValidateAudience = true,
            ValidAudience = firebaseOptions.ProjectId,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;

                if (!string.IsNullOrWhiteSpace(accessToken) && path.StartsWithSegments("/hubs/presence"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            },
            OnTokenValidated = async context =>
            {
                var firebaseUid = context.Principal?.FindFirstValue("user_id")
                    ?? context.Principal?.FindFirstValue("sub");

                if (string.IsNullOrWhiteSpace(firebaseUid))
                {
                    context.Fail("Firebase uid could not be resolved from token claims.");
                    return;
                }

                var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<AppUser>>();
                var localUser = await userManager.Users.FirstOrDefaultAsync(user => user.FirebaseUid == firebaseUid);

                if (localUser is null)
                {
                    context.Fail("No local user mapping found for the Firebase uid.");
                    return;
                }

                var identity = context.Principal?.Identity as ClaimsIdentity;
                if (identity is null)
                {
                    context.Fail("Identity claims cannot be initialized.");
                    return;
                }

                if (!identity.HasClaim(claim => claim.Type == ClaimTypes.NameIdentifier))
                {
                    identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, localUser.Id.ToString()));
                }

                if (!identity.HasClaim(claim => claim.Type == ClaimTypes.Name))
                {
                    identity.AddClaim(new Claim(ClaimTypes.Name, localUser.UserName ?? localUser.Email ?? firebaseUid));
                }

                if (!identity.HasClaim(claim => claim.Type == "firebase_uid"))
                {
                    identity.AddClaim(new Claim("firebase_uid", firebaseUid));
                }

                var roles = await userManager.GetRolesAsync(localUser);
                foreach (var role in roles)
                {
                    if (!identity.HasClaim(ClaimTypes.Role, role))
                    {
                        identity.AddClaim(new Claim(ClaimTypes.Role, role));
                    }
                }
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Configuration.GetValue<bool>("Database:ApplyMigrationsOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
    await DatabaseSeeder.SeedAsync(scope.ServiceProvider, app.Configuration);
}

app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<PresenceHub>("/hubs/presence");

app.MapGet("/", () => Results.Ok(new
{
    service = "Notification24.Api",
    status = "ok",
    utc = DateTime.UtcNow
}));

app.Run();
