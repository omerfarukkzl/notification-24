# Use .NET 10.0 SDK for building
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution file
COPY Notification24.slnx .

# Copy all project files (maintaining directory structure)
# This is a bit tedious but allows caching restore layer
COPY src/backend/Notification24.Api/Notification24.Api.csproj src/backend/Notification24.Api/
COPY src/backend/Notification24.Application/Notification24.Application.csproj src/backend/Notification24.Application/
COPY src/backend/Notification24.Contracts/Notification24.Contracts.csproj src/backend/Notification24.Contracts/
COPY src/backend/Notification24.Domain/Notification24.Domain.csproj src/backend/Notification24.Domain/
COPY src/backend/Notification24.Infrastructure/Notification24.Infrastructure.csproj src/backend/Notification24.Infrastructure/
COPY src/backend/Notification24.Worker/Notification24.Worker.csproj src/backend/Notification24.Worker/

# Restore dependencies
RUN dotnet restore Notification24.slnx

# Copy the rest of the source code
COPY src/backend src/backend

# Build and Publish
WORKDIR /src/src/backend/Notification24.Api
RUN dotnet publish -c Release -o /app/publish

# Use ASP.NET Core Runtime for running
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Expose port (Render uses PORT env var, but 8080/80 is standard)
EXPOSE 8080

ENTRYPOINT ["dotnet", "Notification24.Api.dll"]
