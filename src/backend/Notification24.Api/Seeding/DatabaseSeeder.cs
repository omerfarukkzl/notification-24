using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Notification24.Domain.Constants;
using Notification24.Infrastructure.Identity;

namespace Notification24.Api.Seeding;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(IServiceProvider services, IConfiguration configuration)
    {
        var roleManager = services.GetRequiredService<RoleManager<AppRole>>();
        var userManager = services.GetRequiredService<UserManager<AppUser>>();

        await EnsureRoleAsync(roleManager, RoleNames.Admin);
        await EnsureRoleAsync(roleManager, RoleNames.User);

        var adminUserName = configuration["Seed:AdminUserName"] ?? "admin";
        var adminEmail = configuration["Seed:AdminEmail"] ?? "admin@notification24.local";
        var adminFirebaseUid = configuration["Seed:AdminFirebaseUid"] ?? "replace-with-real-firebase-uid";

        var admin = await userManager.Users.FirstOrDefaultAsync(x => x.FirebaseUid == adminFirebaseUid)
            ?? await userManager.FindByNameAsync(adminUserName);

        if (admin is null)
        {
            admin = new AppUser
            {
                UserName = adminUserName,
                Email = adminEmail,
                FullName = "System Admin",
                FirebaseUid = adminFirebaseUid,
                EmailConfirmed = true,
                IsOnline = false,
                CreatedAtUtc = DateTime.UtcNow
            };

            var createResult = await userManager.CreateAsync(admin);
            if (!createResult.Succeeded)
            {
                var errors = string.Join(';', createResult.Errors.Select(error => error.Description));
                throw new InvalidOperationException($"Failed to seed default admin user: {errors}");
            }
        }
        else
        {
            var mustUpdate = false;

            if (!string.Equals(admin.FirebaseUid, adminFirebaseUid, StringComparison.Ordinal))
            {
                admin.FirebaseUid = adminFirebaseUid;
                mustUpdate = true;
            }

            if (!string.Equals(admin.Email, adminEmail, StringComparison.OrdinalIgnoreCase))
            {
                admin.Email = adminEmail;
                admin.NormalizedEmail = userManager.NormalizeEmail(adminEmail);
                mustUpdate = true;
            }

            if (!string.Equals(admin.UserName, adminUserName, StringComparison.Ordinal))
            {
                admin.UserName = adminUserName;
                admin.NormalizedUserName = userManager.NormalizeName(adminUserName);
                mustUpdate = true;
            }

            if (mustUpdate)
            {
                var updateResult = await userManager.UpdateAsync(admin);
                if (!updateResult.Succeeded)
                {
                    var errors = string.Join(';', updateResult.Errors.Select(error => error.Description));
                    throw new InvalidOperationException($"Failed to update default admin user: {errors}");
                }
            }
        }

        if (!await userManager.IsInRoleAsync(admin, RoleNames.Admin))
        {
            await userManager.AddToRoleAsync(admin, RoleNames.Admin);
        }
    }

    private static async Task EnsureRoleAsync(RoleManager<AppRole> roleManager, string roleName)
    {
        if (await roleManager.RoleExistsAsync(roleName))
        {
            return;
        }

        var result = await roleManager.CreateAsync(new AppRole
        {
            Name = roleName,
            NormalizedName = roleName.ToUpperInvariant()
        });

        if (!result.Succeeded)
        {
            var errors = string.Join(';', result.Errors.Select(error => error.Description));
            throw new InvalidOperationException($"Failed to seed role {roleName}: {errors}");
        }
    }
}
