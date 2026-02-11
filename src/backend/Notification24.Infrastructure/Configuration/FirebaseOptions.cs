namespace Notification24.Infrastructure.Configuration;

public sealed class FirebaseOptions
{
    public const string SectionName = "Firebase";

    public string ProjectId { get; set; } = string.Empty;

    public string? ServiceAccountJsonPath { get; set; }

    public string? ServiceAccountJson { get; set; }
}
