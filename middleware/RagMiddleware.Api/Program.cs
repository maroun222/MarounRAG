using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

using RagMiddleware.Api.Security;
using RagMiddleware.Application.Abstractions;
using RagMiddleware.Application.Abstractions.Persistence;
using RagMiddleware.Application.Abstractions.Security;
using RagMiddleware.Infrastructure.Clients;
using RagMiddleware.Infrastructure.Configuration;
using RagMiddleware.Infrastructure.Persistence;
using RagMiddleware.Infrastructure.Persistence.Repositories;


var builder =
    WebApplication.CreateBuilder(args);

const string FrontendCorsPolicy =
    "FrontendCors";


builder.Services
    .AddOptions<RagApiOptions>()
    .Bind(
        builder.Configuration.GetSection(
            RagApiOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddOptions<MongoDbOptions>()
    .Bind(
        builder.Configuration.GetSection(
            MongoDbOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddOptions<GoogleAuthOptions>()
    .Bind(
        builder.Configuration.GetSection(
            GoogleAuthOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddOptions<JwtOptions>()
    .Bind(
        builder.Configuration.GetSection(
            JwtOptions.SectionName
        )
    )
    .ValidateDataAnnotations()
    .ValidateOnStart();


builder.Services.AddCors(options =>
{
    options.AddPolicy(
        FrontendCorsPolicy,
        policy =>
        {
            policy
                .WithOrigins(
                    "http://localhost:5173",
                    "http://127.0.0.1:5173"
                )
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    );
});


string jwtSigningKey =
    builder.Configuration[
        "Jwt:SigningKey"
    ] ?? throw new InvalidOperationException(
        "Jwt:SigningKey is not configured."
    );

string jwtIssuer =
    builder.Configuration[
        "Jwt:Issuer"
    ] ?? throw new InvalidOperationException(
        "Jwt:Issuer is not configured."
    );

string jwtAudience =
    builder.Configuration[
        "Jwt:Audience"
    ] ?? throw new InvalidOperationException(
        "Jwt:Audience is not configured."
    );

byte[] jwtSigningKeyBytes;

try
{
    jwtSigningKeyBytes =
        Convert.FromBase64String(
            jwtSigningKey
        );
}
catch (FormatException exception)
{
    throw new InvalidOperationException(
        "Jwt:SigningKey must be valid Base64.",
        exception
    );
}

var securityKey =
    new SymmetricSecurityKey(
        jwtSigningKeyBytes
    );

builder.Services
    .AddAuthentication(
        JwtBearerDefaults
            .AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuerSigningKey =
                    true,
                IssuerSigningKey =
                    securityKey,

                ValidateIssuer = true,
                ValidIssuer = jwtIssuer,

                ValidateAudience = true,
                ValidAudience = jwtAudience,

                ValidateLifetime = true,
                RequireExpirationTime =
                    true,
                RequireSignedTokens =
                    true,

                ClockSkew =
                    TimeSpan.FromMinutes(1)
            };
    });

builder.Services.AddAuthorization();


builder.Services.AddSingleton<
    MongoDbContext
>();

builder.Services.AddSingleton<
    MongoConversationRepository
>();

builder.Services.AddSingleton<
    IConversationRepository
>(
    serviceProvider =>
        serviceProvider
            .GetRequiredService<
                MongoConversationRepository
            >()
);

builder.Services.AddHostedService<
    MongoDbIndexInitializer
>();


builder.Services.AddSingleton<
    MongoUserRepository
>();

builder.Services.AddSingleton<
    IUserRepository
>(
    serviceProvider =>
        serviceProvider
            .GetRequiredService<
                MongoUserRepository
            >()
);

builder.Services.AddHostedService<
    MongoUserIndexInitializer
>();


builder.Services.AddSingleton<
    IJwtTokenService,
    JwtTokenService
>();


builder.Services.AddHttpClient<
    IRagApiClient,
    RagApiClient
>(
    (
        serviceProvider,
        httpClient
    ) =>
    {
        RagApiOptions options =
            serviceProvider
                .GetRequiredService<
                    IOptions<RagApiOptions>
                >()
                .Value;

        httpClient.BaseAddress =
            new Uri(
                $"{options.BaseUrl.TrimEnd('/')}/"
            );

        httpClient.Timeout =
            TimeSpan.FromMinutes(5);
    }
);


builder.Services.AddControllers();
builder.Services.AddOpenApi();


var app = builder.Build();


if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(
    FrontendCorsPolicy
);

// app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();